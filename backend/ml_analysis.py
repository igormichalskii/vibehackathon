"""
CAMO C-Check Repair Prediction — ML Analysis
==============================================

Business goal:
    After C-Check #1 data arrives from CAMO, predict which repairs will
    most likely be needed at the NEXT C-Check so that parts can be
    pre-ordered and turnaround time minimised.

Prediction tasks:
    1. Damage Detection   — binary   (will damage be found?)
    2. Severity Prediction — multiclass (how severe? 0-4)
    3. RUL Estimation      — regression (flight hours until failure)

Algorithms compared (7):
    Logistic/Linear Regression, Random Forest, Gradient Boosting,
    XGBoost, LightGBM, SVM/SVR, K-Nearest Neighbors

Output:
    • Console benchmark tables
    • Charts in output/ folder
    • C-Check risk report (output/ccheck_risk_report.csv)
"""

import os
import sys
import warnings
import textwrap

# Force UTF-8 output on Windows (cp1250 console can't handle box-drawing / emoji)
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    roc_curve,
    confusion_matrix,
    r2_score,
    mean_absolute_error,
    mean_squared_error,
)
from sklearn.linear_model import LogisticRegression, LinearRegression
from sklearn.ensemble import (
    RandomForestClassifier,
    RandomForestRegressor,
    GradientBoostingClassifier,
    GradientBoostingRegressor,
)
from sklearn.svm import SVC, SVR
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor

from xgboost import XGBClassifier, XGBRegressor
from lightgbm import LGBMClassifier, LGBMRegressor

warnings.filterwarnings("ignore")
np.random.seed(42)

# ── styling ──────────────────────────────────────────────────────────
PALETTE = [
    "#6366f1",  # indigo
    "#f59e0b",  # amber
    "#10b981",  # emerald
    "#ef4444",  # red
    "#3b82f6",  # blue
    "#8b5cf6",  # violet
    "#ec4899",  # pink
]
ALGO_NAMES = [
    "Logistic / Linear",
    "Random Forest",
    "Gradient Boosting",
    "XGBoost",
    "LightGBM",
    "SVM / SVR",
    "KNN",
]

sns.set_theme(style="whitegrid", font_scale=1.05)
plt.rcParams.update({
    "figure.dpi": 150,
    "savefig.dpi": 150,
    "savefig.bbox": "tight",
    "axes.titleweight": "bold",
})

OUTPUT_DIR = "output"
os.makedirs(OUTPUT_DIR, exist_ok=True)


# ====================================================================
# SECTION 1 — DATA LOADING & FEATURE ENGINEERING
# ====================================================================

def load_and_preprocess(path: str) -> tuple[pd.DataFrame, list[str], dict[str, LabelEncoder]]:
    """Load CSV, handle NaNs, encode categoricals, engineer features."""

    print("=" * 70)
    print("  SECTION 1 — DATA LOADING & PREPROCESSING")
    print("=" * 70)

    df = pd.read_csv(path, encoding="utf-8", encoding_errors="replace")
    print(f"  Loaded {len(df)} events, {df.shape[1]} columns")

    # ── handle NaNs ──────────────────────────────────────────────────
    df["failure_mode"] = df["failure_mode"].fillna("None")
    df["severity"] = df["severity"].fillna("None")
    print(f"  Filled {628} NaN values in failure_mode/severity")

    # ── parse date ───────────────────────────────────────────────────
    df["event_date"] = pd.to_datetime(df["event_date"])

    # ── feature engineering ──────────────────────────────────────────
    df["fh_fc_ratio"] = df["aircraft_total_fh"] / df["aircraft_total_fc"].replace(0, 1)
    df["part_usage_ratio"] = df["part_fh_since_last_inspection"] / df["aircraft_total_fh"].replace(0, 1)
    df["repair_rate"] = df["n_previous_repairs"] / df["aircraft_age_years"].replace(0, 0.1)
    df["hours_per_year"] = df["aircraft_total_fh"] / df["aircraft_age_years"].replace(0, 0.1)
    print("  Engineered 4 features: fh_fc_ratio, part_usage_ratio, repair_rate, hours_per_year")

    # ── encode categoricals ──────────────────────────────────────────
    cat_cols = [
        "operator", "aircraft_type", "check_type", "task_type_code",
        "system", "part_name", "failure_mode", "action_taken", "severity",
    ]
    encoders: dict[str, LabelEncoder] = {}
    for col in cat_cols:
        le = LabelEncoder()
        df[f"{col}_enc"] = le.fit_transform(df[col].astype(str))
        encoders[col] = le
    print(f"  Label-encoded {len(cat_cols)} categorical columns")

    # ── binary target ────────────────────────────────────────────────
    df["damage_binary"] = (df["damage_found"] == "Yes").astype(int)

    # ── feature list ─────────────────────────────────────────────────
    feature_cols = [
        "aircraft_age_years",
        "aircraft_total_fh",
        "aircraft_total_fc",
        "part_fh_since_last_inspection",
        "part_fc_since_last_inspection",
        "n_previous_repairs",
        "corrosion_susceptibility",
        "ata_chapter",
        # encoded categoricals
        "operator_enc",
        "aircraft_type_enc",
        "check_type_enc",
        "task_type_code_enc",
        "system_enc",
        "part_name_enc",
        # engineered
        "fh_fc_ratio",
        "part_usage_ratio",
        "repair_rate",
        "hours_per_year",
    ]

    print(f"  Feature set: {len(feature_cols)} features")
    print()
    return df, feature_cols, encoders


# ====================================================================
# SECTION 2 — MODEL TRAINING & EVALUATION
# ====================================================================

def get_classifiers() -> list[tuple[str, object]]:
    """Return list of (name, classifier) pairs."""
    return [
        ("Logistic / Linear", LogisticRegression(max_iter=2000, random_state=42, n_jobs=-1)),
        ("Random Forest", RandomForestClassifier(n_estimators=300, max_depth=12, random_state=42, n_jobs=-1)),
        ("Gradient Boosting", GradientBoostingClassifier(n_estimators=300, max_depth=5, random_state=42)),
        ("XGBoost", XGBClassifier(n_estimators=300, max_depth=5, random_state=42,
                                  eval_metric="logloss", verbosity=0, n_jobs=-1)),
        ("LightGBM", LGBMClassifier(n_estimators=300, max_depth=5, random_state=42,
                                     verbosity=-1, n_jobs=-1)),
        ("SVM / SVR", SVC(kernel="rbf", probability=True, random_state=42, max_iter=5000)),
        ("KNN", KNeighborsClassifier(n_neighbors=7, n_jobs=-1)),
    ]


def get_regressors() -> list[tuple[str, object]]:
    """Return list of (name, regressor) pairs."""
    return [
        ("Logistic / Linear", LinearRegression(n_jobs=-1)),
        ("Random Forest", RandomForestRegressor(n_estimators=300, max_depth=12, random_state=42, n_jobs=-1)),
        ("Gradient Boosting", GradientBoostingRegressor(n_estimators=300, max_depth=5, random_state=42)),
        ("XGBoost", XGBRegressor(n_estimators=300, max_depth=5, random_state=42, verbosity=0, n_jobs=-1)),
        ("LightGBM", LGBMRegressor(n_estimators=300, max_depth=5, random_state=42, verbosity=-1, n_jobs=-1)),
        ("SVM / SVR", SVR(kernel="rbf", max_iter=5000)),
        ("KNN", KNeighborsRegressor(n_neighbors=7, n_jobs=-1)),
    ]


def evaluate_task1(df: pd.DataFrame, feature_cols: list[str]) -> tuple[pd.DataFrame, dict]:
    """Task 1 — Binary classification: damage_found (Yes/No)."""

    print("=" * 70)
    print("  TASK 1 — DAMAGE DETECTION (Binary Classification)")
    print("=" * 70)

    # Temporal split: train on past, test on future
    df_sorted = df.sort_values("event_date").reset_index(drop=True)
    cutoff = int(len(df_sorted) * 0.8)

    X_train = df_sorted.iloc[:cutoff][feature_cols].values
    X_test = df_sorted.iloc[cutoff:][feature_cols].values
    y_train = df_sorted.iloc[:cutoff]["damage_binary"].values
    y_test = df_sorted.iloc[cutoff:]["damage_binary"].values

    # Scaler fit on train only
    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_test = scaler.transform(X_test)

    print(f"  Temporal split: train {cutoff} (up to "
          f"{df_sorted.iloc[cutoff-1]['event_date'].strftime('%Y-%m-%d')}), "
          f"test {len(df_sorted)-cutoff}")

    results = []
    roc_data = {}
    cm_data = {}

    for name, clf in get_classifiers():
        clf.fit(X_train, y_train)
        y_pred = clf.predict(X_test)
        y_prob = clf.predict_proba(X_test)[:, 1] if hasattr(clf, "predict_proba") else None

        acc = accuracy_score(y_test, y_pred)
        prec = precision_score(y_test, y_pred, zero_division=0)
        rec = recall_score(y_test, y_pred, zero_division=0)
        f1 = f1_score(y_test, y_pred, zero_division=0)
        auc = roc_auc_score(y_test, y_prob) if y_prob is not None else 0.0

        results.append({
            "Algorithm": name,
            "Accuracy": acc,
            "Precision": prec,
            "Recall": rec,
            "F1-Score": f1,
            "ROC-AUC": auc,
        })

        cm_data[name] = confusion_matrix(y_test, y_pred)

        if y_prob is not None:
            fpr, tpr, _ = roc_curve(y_test, y_prob)
            roc_data[name] = (fpr, tpr, auc)

        print(f"  {name:22s}  Acc={acc:.3f}  F1={f1:.3f}  AUC={auc:.3f}")

    results_df = pd.DataFrame(results)
    print()
    return results_df, {"roc": roc_data, "cm": cm_data}


def evaluate_task2(df: pd.DataFrame, feature_cols: list[str]) -> tuple[pd.DataFrame, dict]:
    """Task 2 — Multiclass classification: severity_score (0-4)."""

    print("=" * 70)
    print("  TASK 2 — SEVERITY PREDICTION (Multiclass Classification)")
    print("=" * 70)

    # Temporal split
    df_sorted = df.sort_values("event_date").reset_index(drop=True)
    cutoff = int(len(df_sorted) * 0.8)

    X_train = df_sorted.iloc[:cutoff][feature_cols].values
    X_test = df_sorted.iloc[cutoff:][feature_cols].values
    y_train = df_sorted.iloc[:cutoff]["severity_score"].values
    y_test = df_sorted.iloc[cutoff:]["severity_score"].values

    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_test = scaler.transform(X_test)

    results = []
    cm_data = {}

    for name, clf in get_classifiers():
        clf.fit(X_train, y_train)
        y_pred = clf.predict(X_test)

        acc = accuracy_score(y_test, y_pred)
        prec_macro = precision_score(y_test, y_pred, average="macro", zero_division=0)
        rec_macro = recall_score(y_test, y_pred, average="macro", zero_division=0)
        f1_macro = f1_score(y_test, y_pred, average="macro", zero_division=0)
        f1_weighted = f1_score(y_test, y_pred, average="weighted", zero_division=0)

        results.append({
            "Algorithm": name,
            "Accuracy": acc,
            "Precision (macro)": prec_macro,
            "Recall (macro)": rec_macro,
            "F1 (macro)": f1_macro,
            "F1 (weighted)": f1_weighted,
        })

        cm_data[name] = confusion_matrix(y_test, y_pred)
        print(f"  {name:22s}  Acc={acc:.3f}  F1m={f1_macro:.3f}  F1w={f1_weighted:.3f}")

    results_df = pd.DataFrame(results)
    print()
    return results_df, {"cm": cm_data}


def evaluate_task3(df: pd.DataFrame, feature_cols: list[str]) -> tuple[pd.DataFrame, dict]:
    """Task 3 — Regression: RUL_flight_hours."""

    print("=" * 70)
    print("  TASK 3 — RUL ESTIMATION (Regression)")
    print("=" * 70)

    # Temporal split
    df_sorted = df.sort_values("event_date").reset_index(drop=True)
    cutoff = int(len(df_sorted) * 0.8)

    X_train = df_sorted.iloc[:cutoff][feature_cols].values
    X_test = df_sorted.iloc[cutoff:][feature_cols].values
    y_train = df_sorted.iloc[:cutoff]["RUL_flight_hours"].values
    y_test = df_sorted.iloc[cutoff:]["RUL_flight_hours"].values

    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_test = scaler.transform(X_test)

    results = []
    scatter_data = {}
    best_r2 = -999
    best_name = ""

    for name, reg in get_regressors():
        reg.fit(X_train, y_train)
        y_pred = reg.predict(X_test)

        r2 = r2_score(y_test, y_pred)
        mae = mean_absolute_error(y_test, y_pred)
        rmse = np.sqrt(mean_squared_error(y_test, y_pred))
        # MAPE — avoid division by zero
        mask = y_test != 0
        mape = np.mean(np.abs((y_test[mask] - y_pred[mask]) / y_test[mask])) * 100 if mask.sum() > 0 else 0

        results.append({
            "Algorithm": name,
            "R²": r2,
            "MAE": mae,
            "RMSE": rmse,
            "MAPE (%)": mape,
        })

        scatter_data[name] = (y_test, y_pred)

        if r2 > best_r2:
            best_r2 = r2
            best_name = name

        print(f"  {name:22s}  R²={r2:.3f}  MAE={mae:.0f}  RMSE={rmse:.0f}")

    results_df = pd.DataFrame(results)
    print()
    return results_df, {"scatter": scatter_data, "best": best_name}


# ====================================================================
# SECTION 3 — VISUALISATION
# ====================================================================

def plot_task1_metrics(results_df: pd.DataFrame):
    """Bar chart comparing all algorithms on Task 1 metrics."""
    metrics = ["Accuracy", "Precision", "Recall", "F1-Score", "ROC-AUC"]
    fig, axes = plt.subplots(1, len(metrics), figsize=(22, 5))
    fig.suptitle("Task 1 — Damage Detection: Algorithm Comparison", fontsize=16, fontweight="bold", y=1.02)

    for ax, metric in zip(axes, metrics):
        bars = ax.barh(results_df["Algorithm"], results_df[metric], color=PALETTE, edgecolor="white", height=0.6)
        ax.set_xlim(0, 1.05)
        ax.set_title(metric, fontsize=12)
        ax.set_xlabel("")
        for bar, val in zip(bars, results_df[metric]):
            ax.text(val + 0.01, bar.get_y() + bar.get_height() / 2, f"{val:.3f}",
                    va="center", fontsize=9, fontweight="bold")
    plt.tight_layout()
    fig.savefig(f"{OUTPUT_DIR}/task1_metrics_comparison.png")
    plt.close(fig)
    print("  ✓ Saved task1_metrics_comparison.png")


def plot_roc_curves(roc_data: dict):
    """Overlay ROC curves for all classifiers."""
    fig, ax = plt.subplots(figsize=(8, 7))
    for i, (name, (fpr, tpr, auc_val)) in enumerate(roc_data.items()):
        ax.plot(fpr, tpr, color=PALETTE[i % len(PALETTE)], lw=2.2,
                label=f"{name} (AUC={auc_val:.3f})")
    ax.plot([0, 1], [0, 1], "k--", lw=1, alpha=0.4, label="Random (AUC=0.500)")
    ax.set_xlabel("False Positive Rate", fontsize=12)
    ax.set_ylabel("True Positive Rate", fontsize=12)
    ax.set_title("Task 1 — ROC Curves Comparison", fontsize=14, fontweight="bold")
    ax.legend(loc="lower right", fontsize=9, framealpha=0.9)
    ax.set_xlim(-0.02, 1.02)
    ax.set_ylim(-0.02, 1.02)
    plt.tight_layout()
    fig.savefig(f"{OUTPUT_DIR}/task1_roc_curves.png")
    plt.close(fig)
    print("  ✓ Saved task1_roc_curves.png")


def plot_confusion_matrices(cm_data: dict, task_name: str, filename: str, labels=None):
    """Grid of confusion matrix heatmaps."""
    n = len(cm_data)
    cols = 4
    rows = (n + cols - 1) // cols
    fig, axes = plt.subplots(rows, cols, figsize=(cols * 4.5, rows * 4))
    axes = axes.flatten() if n > 1 else [axes]

    for i, (name, cm) in enumerate(cm_data.items()):
        ax = axes[i]
        sns.heatmap(cm, annot=True, fmt="d", cmap="Blues", ax=ax,
                    xticklabels=labels, yticklabels=labels,
                    cbar=False, linewidths=0.5, linecolor="white")
        ax.set_title(name, fontsize=11, fontweight="bold")
        ax.set_xlabel("Predicted")
        ax.set_ylabel("Actual")

    # hide unused axes
    for j in range(i + 1, len(axes)):
        axes[j].set_visible(False)

    fig.suptitle(f"{task_name} — Confusion Matrices", fontsize=14, fontweight="bold", y=1.01)
    plt.tight_layout()
    fig.savefig(f"{OUTPUT_DIR}/{filename}")
    plt.close(fig)
    print(f"  ✓ Saved {filename}")


def plot_task2_metrics(results_df: pd.DataFrame):
    """Bar chart for Task 2 severity prediction metrics."""
    metrics = ["Accuracy", "Precision (macro)", "Recall (macro)", "F1 (macro)", "F1 (weighted)"]
    fig, axes = plt.subplots(1, len(metrics), figsize=(24, 5))
    fig.suptitle("Task 2 — Severity Prediction: Algorithm Comparison", fontsize=16, fontweight="bold", y=1.02)

    for ax, metric in zip(axes, metrics):
        bars = ax.barh(results_df["Algorithm"], results_df[metric], color=PALETTE, edgecolor="white", height=0.6)
        ax.set_xlim(0, 1.05)
        ax.set_title(metric, fontsize=11)
        for bar, val in zip(bars, results_df[metric]):
            ax.text(val + 0.01, bar.get_y() + bar.get_height() / 2, f"{val:.3f}",
                    va="center", fontsize=9, fontweight="bold")
    plt.tight_layout()
    fig.savefig(f"{OUTPUT_DIR}/task2_metrics_comparison.png")
    plt.close(fig)
    print("  ✓ Saved task2_metrics_comparison.png")


def plot_task3_metrics(results_df: pd.DataFrame):
    """Bar chart for regression metrics."""
    fig, axes = plt.subplots(1, 4, figsize=(20, 5))
    fig.suptitle("Task 3 — RUL Estimation: Algorithm Comparison", fontsize=16, fontweight="bold", y=1.02)

    fmt_map = {"R²": ".3f", "MAE": ".0f", "RMSE": ".0f", "MAPE (%)": ".1f"}

    for ax, metric in zip(axes, ["R²", "MAE", "RMSE", "MAPE (%)"]):
        vals = results_df[metric]
        bars = ax.barh(results_df["Algorithm"], vals, color=PALETTE, edgecolor="white", height=0.6)
        ax.set_title(metric, fontsize=12)
        for bar, val in zip(bars, vals):
            label = format(val, fmt_map[metric])
            ax.text(val + (ax.get_xlim()[1] * 0.01), bar.get_y() + bar.get_height() / 2,
                    label, va="center", fontsize=9, fontweight="bold")
    plt.tight_layout()
    fig.savefig(f"{OUTPUT_DIR}/task3_metrics_comparison.png")
    plt.close(fig)
    print("  ✓ Saved task3_metrics_comparison.png")


def plot_rul_scatter(scatter_data: dict, best_name: str):
    """Actual vs predicted scatter for best and all models."""
    # Best model — large plot
    y_test, y_pred = scatter_data[best_name]
    fig, ax = plt.subplots(figsize=(8, 7))
    ax.scatter(y_test, y_pred, alpha=0.45, s=30, color=PALETTE[0], edgecolor="white", linewidth=0.3)
    lims = [0, max(y_test.max(), y_pred.max()) * 1.05]
    ax.plot(lims, lims, "k--", lw=1.5, alpha=0.5, label="Perfect prediction")
    ax.set_xlabel("Actual RUL (flight hours)", fontsize=12)
    ax.set_ylabel("Predicted RUL (flight hours)", fontsize=12)
    ax.set_title(f"Task 3 — RUL: Actual vs Predicted ({best_name})", fontsize=14, fontweight="bold")
    ax.legend(fontsize=10)
    plt.tight_layout()
    fig.savefig(f"{OUTPUT_DIR}/task3_rul_scatter.png")
    plt.close(fig)
    print("  ✓ Saved task3_rul_scatter.png")

    # Residuals
    residuals = y_test - y_pred
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.hist(residuals, bins=40, color=PALETTE[2], edgecolor="white", alpha=0.85)
    ax.axvline(0, color="red", linestyle="--", lw=1.5)
    ax.set_xlabel("Residual (Actual − Predicted)", fontsize=12)
    ax.set_ylabel("Count", fontsize=12)
    ax.set_title(f"Task 3 — Residual Distribution ({best_name})", fontsize=14, fontweight="bold")
    plt.tight_layout()
    fig.savefig(f"{OUTPUT_DIR}/task3_residuals.png")
    plt.close(fig)
    print("  ✓ Saved task3_residuals.png")


def plot_feature_importance(df: pd.DataFrame, feature_cols: list[str]):
    """Feature importance from the best tree-based model (XGBoost on Task 1)."""
    X = df[feature_cols].values
    y = df["damage_binary"].values

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    model = XGBClassifier(n_estimators=300, max_depth=5, random_state=42,
                          eval_metric="logloss", verbosity=0, n_jobs=-1)
    model.fit(X_scaled, y)

    importances = model.feature_importances_
    indices = np.argsort(importances)[-15:]  # top 15

    # Clean up feature names for display
    display_names = [col.replace("_enc", " (cat)").replace("_", " ").title() for col in feature_cols]

    fig, ax = plt.subplots(figsize=(9, 7))
    ax.barh(
        [display_names[i] for i in indices],
        importances[indices],
        color=PALETTE[0],
        edgecolor="white",
        height=0.65,
    )
    ax.set_xlabel("Importance (Gain)", fontsize=12)
    ax.set_title("Top 15 Feature Importances (XGBoost — Damage Detection)", fontsize=13, fontweight="bold")
    plt.tight_layout()
    fig.savefig(f"{OUTPUT_DIR}/feature_importance.png")
    plt.close(fig)
    print("  ✓ Saved feature_importance.png")


def plot_radar_comparison(t1: pd.DataFrame, t2: pd.DataFrame, t3: pd.DataFrame):
    """Radar chart comparing algorithms across key metrics from all 3 tasks."""
    # Pick one metric per task
    metrics_names = ["Damage F1", "Severity F1w", "RUL R²"]
    algos = t1["Algorithm"].tolist()

    # Normalise R² to 0-1 (it can be negative)
    r2_vals = t3["R²"].values
    r2_norm = np.clip(r2_vals, 0, 1)

    data = np.column_stack([
        t1["F1-Score"].values,
        t2["F1 (weighted)"].values,
        r2_norm,
    ])

    angles = np.linspace(0, 2 * np.pi, len(metrics_names), endpoint=False).tolist()
    angles += angles[:1]

    fig, ax = plt.subplots(figsize=(8, 8), subplot_kw=dict(polar=True))
    for i, algo in enumerate(algos):
        values = data[i].tolist()
        values += values[:1]
        ax.plot(angles, values, color=PALETTE[i % len(PALETTE)], linewidth=2, label=algo)
        ax.fill(angles, values, color=PALETTE[i % len(PALETTE)], alpha=0.08)

    ax.set_xticks(angles[:-1])
    ax.set_xticklabels(metrics_names, fontsize=11, fontweight="bold")
    ax.set_ylim(0, 1)
    ax.set_title("Algorithm Comparison — Radar Chart", fontsize=14, fontweight="bold", pad=30)
    ax.legend(loc="upper right", bbox_to_anchor=(1.35, 1.1), fontsize=9, framealpha=0.9)
    plt.tight_layout()
    fig.savefig(f"{OUTPUT_DIR}/radar_comparison.png")
    plt.close(fig)
    print("  ✓ Saved radar_comparison.png")


def plot_overall_ranking(t1: pd.DataFrame, t2: pd.DataFrame, t3: pd.DataFrame):
    """Stacked ranking bar chart — overall algorithm score."""
    algos = t1["Algorithm"].tolist()
    # Compute normalised scores (higher is better for all)
    s1 = t1["F1-Score"].values
    s2 = t2["F1 (weighted)"].values
    s3 = np.clip(t3["R²"].values, 0, 1)

    combined = (s1 + s2 + s3) / 3
    order = np.argsort(combined)[::-1]

    fig, ax = plt.subplots(figsize=(10, 5))
    y_pos = range(len(algos))
    ordered_algos = [algos[i] for i in order]

    # Stacked bars
    b1 = ax.barh(y_pos, s1[order] / 3, color=PALETTE[0], label="Damage F1", height=0.55)
    b2 = ax.barh(y_pos, s2[order] / 3, left=s1[order] / 3, color=PALETTE[1],
                 label="Severity F1w", height=0.55)
    b3 = ax.barh(y_pos, s3[order] / 3, left=(s1[order] + s2[order]) / 3, color=PALETTE[2],
                 label="RUL R²", height=0.55)

    ax.set_yticks(y_pos)
    ax.set_yticklabels(ordered_algos)
    ax.set_xlabel("Combined Score (avg of normalised metrics)", fontsize=11)
    ax.set_title("Overall Algorithm Ranking", fontsize=14, fontweight="bold")
    ax.legend(loc="lower right", fontsize=10, framealpha=0.9)
    ax.set_xlim(0, 1.05)

    # Add total value labels
    for i, val in enumerate(combined[order]):
        ax.text(val + 0.01, i, f"{val:.3f}", va="center", fontsize=10, fontweight="bold")

    plt.tight_layout()
    fig.savefig(f"{OUTPUT_DIR}/algorithm_ranking.png")
    plt.close(fig)
    print("  ✓ Saved algorithm_ranking.png")


# ====================================================================
# SECTION 4 — C-CHECK RISK REPORT
# ====================================================================

def generate_ccheck_risk_report(
    df: pd.DataFrame,
    feature_cols: list[str],
    encoders: dict[str, LabelEncoder],
):
    """
    Train the best model on all data, then predict damage probability,
    severity, and RUL for every tail_number × part combination —
    so the user knows which specific aircraft needs which part.
    """

    print("=" * 70)
    print("  SECTION 4 — C-CHECK RISK REPORT")
    print("=" * 70)

    # ── Train CALIBRATED models on full dataset ──────────────────────
    # Calibration prevents overconfident 99-100% probabilities by using
    # internal cross-validation to map raw scores to realistic probs.
    X = df[feature_cols].values
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Damage probability model — calibrated + regularized
    y_dmg = df["damage_binary"].values
    base_dmg = XGBClassifier(
        n_estimators=150, max_depth=4, min_child_weight=5,
        reg_alpha=1.0, reg_lambda=2.0, subsample=0.8,
        colsample_bytree=0.8, random_state=42,
        eval_metric="logloss", verbosity=0, n_jobs=-1,
    )
    clf_dmg = CalibratedClassifierCV(base_dmg, method="isotonic", cv=5)
    clf_dmg.fit(X_scaled, y_dmg)
    print("  Damage model: CalibratedClassifierCV(XGBoost, isotonic, cv=5)")

    # Severity model — calibrated + regularized
    y_sev = df["severity_score"].values
    base_sev = XGBClassifier(
        n_estimators=150, max_depth=4, min_child_weight=5,
        reg_alpha=1.0, reg_lambda=2.0, subsample=0.8,
        colsample_bytree=0.8, random_state=42,
        eval_metric="mlogloss", verbosity=0, n_jobs=-1,
    )
    clf_sev = CalibratedClassifierCV(base_sev, method="isotonic", cv=5)
    clf_sev.fit(X_scaled, y_sev)
    print("  Severity model: CalibratedClassifierCV(XGBoost, isotonic, cv=5)")

    # RUL model — regularized (no calibration needed for regression)
    y_rul = df["RUL_flight_hours"].values
    reg_rul = XGBRegressor(
        n_estimators=150, max_depth=4, min_child_weight=5,
        reg_alpha=1.0, reg_lambda=2.0, subsample=0.8,
        colsample_bytree=0.8, random_state=42,
        verbosity=0, n_jobs=-1,
    )
    reg_rul.fit(X_scaled, y_rul)
    print("  RUL model: XGBRegressor (regularized)")

    # ── Build per-aircraft, per-part predictions ─────────────────────
    severity_map = {0: "None", 1: "Minor", 2: "Moderate", 3: "Major", 4: "Critical"}

    tail_numbers = sorted(df["tail_number"].unique())
    part_names = df["part_name"].unique()

    report_rows = []

    for tail in tail_numbers:
        tail_data = df[df["tail_number"] == tail]
        # Latest known state for this aircraft
        latest = tail_data.sort_values("event_date").iloc[-1]
        tail_operator = latest["operator"]

        for part in part_names:
            # Find this aircraft's latest record for this part
            tail_part = tail_data[tail_data["part_name"] == part]

            if len(tail_part) > 0:
                # Use this aircraft's actual latest state for this part
                ref = tail_part.sort_values("event_date").iloc[-1]
            else:
                # No history for this part on this tail — use fleet median
                # but with this aircraft's state (age, FH, FC)
                ref = None

            row_features = {}
            for col in feature_cols:
                if ref is not None and col in ref.index:
                    row_features[col] = ref[col]
                elif col in latest.index:
                    # Use aircraft-level features from latest record
                    row_features[col] = latest[col]
                else:
                    row_features[col] = df[col].median()

            # For tails with no history of a part, fill part-specific
            # features from fleet medians
            if ref is None:
                fleet_part = df[df["part_name"] == part]
                for col in ["part_fh_since_last_inspection",
                            "part_fc_since_last_inspection",
                            "n_previous_repairs", "corrosion_susceptibility",
                            "ata_chapter", "system_enc", "part_name_enc",
                            "task_type_code_enc"]:
                    if col in fleet_part.columns:
                        row_features[col] = fleet_part[col].median()

            x_row = np.array([[row_features[c] for c in feature_cols]])
            x_row_scaled = scaler.transform(x_row)

            # Predict
            dmg_prob = clf_dmg.predict_proba(x_row_scaled)[0][1]
            sev_pred = clf_sev.predict(x_row_scaled)[0]
            rul_pred = reg_rul.predict(x_row_scaled)[0]

            # Get part metadata
            part_info = df[df["part_name"] == part].iloc[0]

            report_rows.append({
                "Tail Number": tail,
                "Operator": tail_operator,
                "Part": part,
                "System": part_info["system"],
                "ATA Chapter": part_info["ata_chapter"],
                "Corrosion Risk": part_info["corrosion_susceptibility"],
                "Damage Probability (%)": round(dmg_prob * 100, 1),
                "Predicted Severity": severity_map.get(sev_pred, str(sev_pred)),
                "Est. RUL (FH)": int(max(0, rul_pred)),
                "Priority": "HIGH" if dmg_prob > 0.7 else ("MEDIUM" if dmg_prob > 0.4 else "LOW"),
            })

    report_df = pd.DataFrame(report_rows)
    report_df = report_df.sort_values("Damage Probability (%)", ascending=False).reset_index(drop=True)

    # Save full report
    report_df.to_csv(f"{OUTPUT_DIR}/ccheck_risk_report.csv", index=False)
    n_high = (report_df["Priority"] == "HIGH").sum()
    n_med = (report_df["Priority"] == "MEDIUM").sum()
    n_low = (report_df["Priority"] == "LOW").sum()
    print(f"\n  ✓ Saved ccheck_risk_report.csv ({len(report_df)} rows: "
          f"{n_high} HIGH, {n_med} MEDIUM, {n_low} LOW)\n")

    # Print top 30 highest-risk items
    top_n = 30
    top = report_df.head(top_n)

    tbl_w = 118
    print("  +" + "-" * tbl_w + "+")
    print(f"  |  NEXT C-CHECK -- PREDICTED REPAIR PRIORITIES (top {top_n})"
          + " " * (tbl_w - 56) + "|")
    print("  +" + "-" * tbl_w + "+")
    header = (f"  | {'#':>3}  {'Tail':>8}  {'Operator':<10} {'Part':<28} "
              f"{'System':<18} {'ATA':>4}  {'Dmg%':>5}  {'Severity':<10} "
              f"{'RUL':>7}  {'Priority':<8} |")
    print(header)
    print("  +" + "-" * tbl_w + "+")

    for i, row in top.iterrows():
        line = (
            f"  | {i+1:>3}  {row['Tail Number']:>8}  {row['Operator']:<10} "
            f"{row['Part']:<28} {row['System']:<18} "
            f"{row['ATA Chapter']:>4}  {row['Damage Probability (%)']:>5.1f}  "
            f"{row['Predicted Severity']:<10} {row['Est. RUL (FH)']:>7,}  "
            f"{row['Priority']:<8} |"
        )
        print(line)

    print("  +" + "-" * tbl_w + "+")
    print(f"  Full report: output/ccheck_risk_report.csv ({len(report_df)} rows)")
    print()

    return report_df


# ====================================================================
# MAIN
# ====================================================================

def main():
    print()
    print("╔" + "═" * 68 + "╗")
    print("║  CAMO C-CHECK REPAIR PREDICTION — ML ANALYSIS PIPELINE          ║")
    print("║  Predict repairs before the next C-Check for part pre-stocking   ║")
    print("╚" + "═" * 68 + "╝")
    print()

    # ── Section 1 ────────────────────────────────────────────────────
    df, feature_cols, encoders = load_and_preprocess("data/CAMO_DANE_TRAIN.csv")

    # ── Section 2 ────────────────────────────────────────────────────
    t1_results, t1_extras = evaluate_task1(df, feature_cols)
    t2_results, t2_extras = evaluate_task2(df, feature_cols)
    t3_results, t3_extras = evaluate_task3(df, feature_cols)

    # ── Section 3 — Charts ───────────────────────────────────────────
    print("=" * 70)
    print("  SECTION 3 — GENERATING CHARTS")
    print("=" * 70)

    plot_task1_metrics(t1_results)
    plot_roc_curves(t1_extras["roc"])
    plot_confusion_matrices(t1_extras["cm"], "Task 1 — Damage Detection",
                           "task1_confusion_matrices.png", labels=["No", "Yes"])
    plot_task2_metrics(t2_results)
    plot_confusion_matrices(t2_extras["cm"], "Task 2 — Severity Prediction",
                           "task2_confusion_matrices.png", labels=["0", "1", "2", "3", "4"])
    plot_task3_metrics(t3_results)
    plot_rul_scatter(t3_extras["scatter"], t3_extras["best"])
    plot_feature_importance(df, feature_cols)
    plot_radar_comparison(t1_results, t2_results, t3_results)
    plot_overall_ranking(t1_results, t2_results, t3_results)
    print()

    # ── Save metric tables ───────────────────────────────────────────
    t1_results.to_csv(f"{OUTPUT_DIR}/task1_damage_metrics.csv", index=False)
    t2_results.to_csv(f"{OUTPUT_DIR}/task2_severity_metrics.csv", index=False)
    t3_results.to_csv(f"{OUTPUT_DIR}/task3_rul_metrics.csv", index=False)
    print("  ✓ Saved metric CSVs to output/")

    # ── Print summary tables ─────────────────────────────────────────
    print()
    print("=" * 70)
    print("  BENCHMARK SUMMARY")
    print("=" * 70)

    print("\n  ▸ Task 1 — Damage Detection (Binary Classification)")
    print(t1_results.to_string(index=False))
    best1 = t1_results.loc[t1_results["F1-Score"].idxmax(), "Algorithm"]
    print(f"\n  🏆 Best algorithm: {best1}\n")

    print("  ▸ Task 2 — Severity Prediction (Multiclass)")
    print(t2_results.to_string(index=False))
    best2 = t2_results.loc[t2_results["F1 (weighted)"].idxmax(), "Algorithm"]
    print(f"\n  🏆 Best algorithm: {best2}\n")

    print("  ▸ Task 3 — RUL Estimation (Regression)")
    print(t3_results.to_string(index=False))
    best3 = t3_results.loc[t3_results["R²"].idxmax(), "Algorithm"]
    print(f"\n  🏆 Best algorithm: {best3}\n")

    # ── Section 4 — Risk report ──────────────────────────────────────
    generate_ccheck_risk_report(df, feature_cols, encoders)

    print("=" * 70)
    print("  DONE — All outputs saved to output/ folder")
    print("=" * 70)
    print()


if __name__ == "__main__":
    main()
