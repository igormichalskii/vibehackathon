"""
C-Check Risk Report — Visualisation Dashboard
================================================

Reads output/ccheck_risk_report.csv and generates a suite of
actionable charts to help CAMO planners prioritise parts and aircraft.

Charts produced (saved to output/):
  1. Fleet heatmap         — tail × system damage probability
  2. Top 25 critical items — horizontal bar chart
  3. Priority distribution — donut chart per operator
  4. System risk boxplots  — damage probability spread per system
  5. RUL urgency scatter   — damage probability vs remaining life
  6. Per-aircraft radar     — top 5 riskiest tails
  7. ATA chapter treemap   — risk concentration by chapter
  8. Corrosion risk vs damage — bubble chart
"""

import sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
from matplotlib.patches import FancyBboxPatch
import seaborn as sns
from matplotlib.colors import LinearSegmentedColormap

# ── Styling ──────────────────────────────────────────────────────────
sns.set_theme(style="whitegrid", font_scale=1.0)
plt.rcParams.update({
    "figure.dpi": 160,
    "savefig.dpi": 160,
    "savefig.bbox": "tight",
    "axes.titleweight": "bold",
    "font.family": "sans-serif",
})

# Custom palettes
RISK_CMAP = LinearSegmentedColormap.from_list(
    "risk", ["#10b981", "#fbbf24", "#f97316", "#ef4444", "#991b1b"]
)
OPERATOR_COLORS = {
    "KLM": "#00A1DE",
    "Ryanair": "#073590",
    "Norwegian": "#D81939",
    "TUI fly": "#FFD700",
}
PRIORITY_COLORS = {"HIGH": "#ef4444", "MEDIUM": "#f59e0b", "LOW": "#10b981"}
SEVERITY_ORDER = ["None", "Minor", "Moderate", "Major", "Critical"]

OUTPUT = "output"


def load_report() -> pd.DataFrame:
    """Load and enrich the risk report."""
    df = pd.read_csv(f"{OUTPUT}/ccheck_risk_report.csv")
    df["Predicted Severity"] = pd.Categorical(
        df["Predicted Severity"], categories=SEVERITY_ORDER, ordered=True
    )
    print(f"  Loaded {len(df)} rows  |  "
          f"{df['Tail Number'].nunique()} aircraft  |  "
          f"{df['Part'].nunique()} parts  |  "
          f"{df['System'].nunique()} systems")
    return df


# ── 1. Fleet Heatmap ─────────────────────────────────────────────────

def plot_fleet_heatmap(df: pd.DataFrame):
    """Tail × System heatmap of mean damage probability."""
    pivot = df.pivot_table(
        index="Tail Number", columns="System",
        values="Damage Probability (%)", aggfunc="mean"
    )
    # Sort rows by mean risk descending
    pivot = pivot.loc[pivot.mean(axis=1).sort_values(ascending=False).index]

    fig, ax = plt.subplots(figsize=(16, 10))
    sns.heatmap(
        pivot, cmap=RISK_CMAP, annot=True, fmt=".0f", linewidths=0.4,
        linecolor="white", cbar_kws={"label": "Damage Probability (%)"},
        ax=ax, vmin=0, vmax=100,
    )
    ax.set_title("Fleet Risk Heatmap — Mean Damage Probability by Aircraft × System",
                 fontsize=15, pad=15)
    ax.set_xlabel("")
    ax.set_ylabel("")
    ax.tick_params(axis="x", rotation=35, labelsize=9)
    ax.tick_params(axis="y", rotation=0, labelsize=9)
    plt.tight_layout()
    fig.savefig(f"{OUTPUT}/viz_fleet_heatmap.png")
    plt.close(fig)
    print("  [1/8] Saved viz_fleet_heatmap.png")


# ── 2. Top 25 Critical Items ─────────────────────────────────────────

def plot_top_critical(df: pd.DataFrame):
    """Top 25 highest damage-probability items."""
    top = df.nlargest(25, "Damage Probability (%)").reset_index(drop=True)
    top["label"] = top["Tail Number"] + " | " + top["Part"]
    top = top.iloc[::-1]  # flip for horizontal bar

    fig, ax = plt.subplots(figsize=(12, 9))
    colors = [OPERATOR_COLORS.get(op, "#6366f1") for op in top["Operator"]]
    bars = ax.barh(top["label"], top["Damage Probability (%)"],
                   color=colors, edgecolor="white", height=0.7)

    # Add RUL annotation on bars
    for bar, rul, sev in zip(bars, top["Est. RUL (FH)"], top["Predicted Severity"]):
        w = bar.get_width()
        ax.text(w - 1, bar.get_y() + bar.get_height() / 2,
                f"RUL:{rul:,}h  |  {sev}",
                ha="right", va="center", fontsize=7.5, color="white", fontweight="bold")

    ax.set_xlim(0, 105)
    ax.set_xlabel("Damage Probability (%)", fontsize=11)
    ax.set_title("Top 25 Highest-Risk Items for Next C-Check", fontsize=14, pad=12)

    # Legend for operators
    from matplotlib.patches import Patch
    legend_handles = [Patch(facecolor=c, label=op) for op, c in OPERATOR_COLORS.items()]
    ax.legend(handles=legend_handles, loc="lower right", fontsize=9, framealpha=0.9)

    plt.tight_layout()
    fig.savefig(f"{OUTPUT}/viz_top25_critical.png")
    plt.close(fig)
    print("  [2/8] Saved viz_top25_critical.png")


# ── 3. Priority Distribution per Operator ─────────────────────────────

def plot_priority_donuts(df: pd.DataFrame):
    """Donut charts showing HIGH/MEDIUM/LOW split per operator."""
    operators = sorted(df["Operator"].unique())
    n = len(operators)
    fig, axes = plt.subplots(1, n, figsize=(4.5 * n, 4.5))
    if n == 1:
        axes = [axes]

    for ax, op in zip(axes, operators):
        sub = df[df["Operator"] == op]
        counts = sub["Priority"].value_counts()
        sizes = [counts.get(p, 0) for p in ["HIGH", "MEDIUM", "LOW"]]
        colors = [PRIORITY_COLORS[p] for p in ["HIGH", "MEDIUM", "LOW"]]
        labels = [f"HIGH ({sizes[0]})", f"MEDIUM ({sizes[1]})", f"LOW ({sizes[2]})"]

        wedges, texts, autotexts = ax.pie(
            sizes, labels=labels, colors=colors, autopct="%1.0f%%",
            startangle=90, pctdistance=0.78, wedgeprops=dict(width=0.42, edgecolor="white"),
            textprops={"fontsize": 8},
        )
        for t in autotexts:
            t.set_fontsize(8)
            t.set_fontweight("bold")
        ax.set_title(op, fontsize=13, fontweight="bold",
                     color=OPERATOR_COLORS.get(op, "#333"))
        # Center label
        total = sum(sizes)
        ax.text(0, 0, f"{total}\nparts", ha="center", va="center",
                fontsize=12, fontweight="bold", color="#555")

    fig.suptitle("Priority Distribution by Operator", fontsize=15, fontweight="bold", y=1.02)
    plt.tight_layout()
    fig.savefig(f"{OUTPUT}/viz_priority_donuts.png")
    plt.close(fig)
    print("  [3/8] Saved viz_priority_donuts.png")


# ── 4. System Risk Boxplots ──────────────────────────────────────────

def plot_system_boxplots(df: pd.DataFrame):
    """Boxplots of damage probability spread per system."""
    order = (df.groupby("System")["Damage Probability (%)"]
             .median().sort_values(ascending=False).index)

    fig, ax = plt.subplots(figsize=(14, 7))
    bp = sns.boxplot(
        data=df, y="System", x="Damage Probability (%)", order=order,
        palette="YlOrRd", ax=ax, width=0.6, linewidth=1.2,
        flierprops=dict(marker="o", markerfacecolor="#ef4444", markersize=3, alpha=0.4),
    )
    # Overlay strip
    sns.stripplot(
        data=df, y="System", x="Damage Probability (%)", order=order,
        color="#333", ax=ax, size=2, alpha=0.15, jitter=True,
    )

    ax.axvline(70, color="#ef4444", ls="--", lw=1.2, alpha=0.6, label="HIGH threshold (70%)")
    ax.axvline(40, color="#f59e0b", ls="--", lw=1.2, alpha=0.6, label="MEDIUM threshold (40%)")
    ax.legend(fontsize=9, loc="lower right")
    ax.set_title("Damage Probability Distribution by System", fontsize=14, pad=12)
    ax.set_xlabel("Damage Probability (%)", fontsize=11)
    ax.set_ylabel("")
    plt.tight_layout()
    fig.savefig(f"{OUTPUT}/viz_system_boxplots.png")
    plt.close(fig)
    print("  [4/8] Saved viz_system_boxplots.png")


# ── 5. RUL Urgency Scatter ───────────────────────────────────────────

def plot_rul_urgency(df: pd.DataFrame):
    """Scatter: Damage probability (y) vs RUL (x) — top-left = most urgent."""
    fig, ax = plt.subplots(figsize=(13, 8))

    # Color by priority
    for prio, color in PRIORITY_COLORS.items():
        sub = df[df["Priority"] == prio]
        ax.scatter(
            sub["Est. RUL (FH)"], sub["Damage Probability (%)"],
            c=color, s=40, alpha=0.55, edgecolors="white", linewidth=0.3,
            label=f"{prio} ({len(sub)})", zorder=3 if prio == "HIGH" else 2,
        )

    # Danger zone highlight (high damage, low RUL)
    ax.axhspan(70, 105, xmin=0, xmax=0.2, alpha=0.06, color="#ef4444", zorder=0)
    ax.text(500, 102, "DANGER ZONE\nHigh damage + Low RUL",
            fontsize=9, color="#ef4444", fontweight="bold", va="top")

    # Annotate top 5 most urgent (high dmg + low RUL)
    urgent = df[df["Priority"] == "HIGH"].nsmallest(5, "Est. RUL (FH)")
    for _, row in urgent.iterrows():
        ax.annotate(
            f"{row['Tail Number']}\n{row['Part']}",
            xy=(row["Est. RUL (FH)"], row["Damage Probability (%)"]),
            xytext=(row["Est. RUL (FH)"] + 1500, row["Damage Probability (%)"] - 3),
            fontsize=7, fontweight="bold", color="#991b1b",
            arrowprops=dict(arrowstyle="->", color="#991b1b", lw=0.8),
        )

    ax.set_xlabel("Estimated RUL (Flight Hours)", fontsize=11)
    ax.set_ylabel("Damage Probability (%)", fontsize=11)
    ax.set_title("Urgency Map — Damage Probability vs Remaining Useful Life",
                 fontsize=14, pad=12)
    ax.legend(fontsize=10, loc="lower right", framealpha=0.9)
    ax.set_xlim(-500, df["Est. RUL (FH)"].max() * 1.05)
    ax.set_ylim(-2, 105)
    plt.tight_layout()
    fig.savefig(f"{OUTPUT}/viz_rul_urgency.png")
    plt.close(fig)
    print("  [5/8] Saved viz_rul_urgency.png")


# ── 6. Per-Aircraft Radar (top 5 riskiest) ───────────────────────────

def plot_aircraft_radar(df: pd.DataFrame):
    """Radar chart for the 5 riskiest aircraft, one spoke per system."""
    # Find top 5 riskiest tails by mean damage probability
    tail_risk = df.groupby("Tail Number")["Damage Probability (%)"].mean()
    top5 = tail_risk.nlargest(5).index.tolist()

    systems = sorted(df["System"].unique())
    n_sys = len(systems)
    angles = np.linspace(0, 2 * np.pi, n_sys, endpoint=False).tolist()
    angles += angles[:1]

    colors = ["#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6", "#10b981"]

    fig, ax = plt.subplots(figsize=(10, 10), subplot_kw=dict(polar=True))

    for i, tail in enumerate(top5):
        sub = df[df["Tail Number"] == tail]
        values = []
        for sys_name in systems:
            sys_data = sub[sub["System"] == sys_name]
            values.append(sys_data["Damage Probability (%)"].mean() if len(sys_data) > 0 else 0)
        values += values[:1]

        op = sub["Operator"].iloc[0]
        ax.plot(angles, values, color=colors[i], linewidth=2.2,
                label=f"{tail} ({op})")
        ax.fill(angles, values, color=colors[i], alpha=0.07)

    ax.set_xticks(angles[:-1])
    ax.set_xticklabels(systems, fontsize=8.5, fontweight="bold")
    ax.set_ylim(0, 105)
    ax.set_title("Top 5 Riskiest Aircraft — Risk Profile by System",
                 fontsize=14, fontweight="bold", pad=30)
    ax.legend(loc="upper right", bbox_to_anchor=(1.35, 1.1), fontsize=9.5, framealpha=0.9)
    plt.tight_layout()
    fig.savefig(f"{OUTPUT}/viz_aircraft_radar.png")
    plt.close(fig)
    print("  [6/8] Saved viz_aircraft_radar.png")


# ── 7. ATA Chapter Risk Bar ──────────────────────────────────────────

def plot_ata_risk(df: pd.DataFrame):
    """Grouped bar: mean damage probability and HIGH-count by ATA chapter."""
    ata_stats = df.groupby("ATA Chapter").agg(
        mean_dmg=("Damage Probability (%)", "mean"),
        high_count=("Priority", lambda x: (x == "HIGH").sum()),
        total=("Priority", "count"),
    ).reset_index()
    ata_stats = ata_stats.sort_values("mean_dmg", ascending=False)

    fig, ax1 = plt.subplots(figsize=(13, 6))

    x = np.arange(len(ata_stats))
    w = 0.38

    bars1 = ax1.bar(x - w / 2, ata_stats["mean_dmg"], w,
                    color="#6366f1", label="Mean Damage Prob. (%)", edgecolor="white")
    ax1.set_ylabel("Mean Damage Probability (%)", fontsize=11, color="#6366f1")
    ax1.set_ylim(0, 105)
    ax1.tick_params(axis="y", labelcolor="#6366f1")

    ax2 = ax1.twinx()
    bars2 = ax2.bar(x + w / 2, ata_stats["high_count"], w,
                    color="#ef4444", alpha=0.75, label="HIGH priority count", edgecolor="white")
    ax2.set_ylabel("HIGH Priority Count", fontsize=11, color="#ef4444")
    ax2.tick_params(axis="y", labelcolor="#ef4444")

    ax1.set_xticks(x)
    ax1.set_xticklabels([f"ATA {c}" for c in ata_stats["ATA Chapter"]],
                        rotation=30, ha="right", fontsize=9)
    ax1.set_title("Risk Concentration by ATA Chapter", fontsize=14, pad=12)

    lines1, labels1 = ax1.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax1.legend(lines1 + lines2, labels1 + labels2, loc="upper right", fontsize=9)

    plt.tight_layout()
    fig.savefig(f"{OUTPUT}/viz_ata_risk.png")
    plt.close(fig)
    print("  [7/8] Saved viz_ata_risk.png")


# ── 8. Corrosion vs Damage Bubble Chart ──────────────────────────────

def plot_corrosion_bubble(df: pd.DataFrame):
    """Bubble chart: corrosion susceptibility vs damage probability,
    bubble size = number of HIGH items, color = system."""
    agg = df.groupby(["System", "Corrosion Risk"]).agg(
        mean_dmg=("Damage Probability (%)", "mean"),
        high_count=("Priority", lambda x: (x == "HIGH").sum()),
        mean_rul=("Est. RUL (FH)", "mean"),
    ).reset_index()

    systems = agg["System"].unique()
    system_colors = plt.cm.tab20(np.linspace(0, 1, len(systems)))
    color_map = dict(zip(systems, system_colors))

    fig, ax = plt.subplots(figsize=(12, 8))

    for _, row in agg.iterrows():
        size = max(row["high_count"] * 18, 30)
        ax.scatter(
            row["Corrosion Risk"], row["mean_dmg"],
            s=size, c=[color_map[row["System"]]], alpha=0.7,
            edgecolors="white", linewidth=0.5, zorder=3,
        )

    # Create legend for systems
    from matplotlib.patches import Patch
    handles = [Patch(facecolor=color_map[s], label=s) for s in sorted(systems)]
    ax.legend(handles=handles, loc="lower right", fontsize=8, ncol=2, framealpha=0.9)

    ax.set_xlabel("Corrosion Susceptibility (1-10)", fontsize=11)
    ax.set_ylabel("Mean Damage Probability (%)", fontsize=11)
    ax.set_title("Corrosion Susceptibility vs Predicted Damage — Bubble = HIGH count",
                 fontsize=13, pad=12)
    ax.set_xlim(0, 11)
    ax.set_ylim(-2, 105)
    plt.tight_layout()
    fig.savefig(f"{OUTPUT}/viz_corrosion_bubble.png")
    plt.close(fig)
    print("  [8/8] Saved viz_corrosion_bubble.png")


# ── Main ──────────────────────────────────────────────────────────────

def main():
    print()
    print("=" * 60)
    print("  C-CHECK RISK REPORT — VISUALISATION")
    print("=" * 60)
    print()

    df = load_report()
    print()

    plot_fleet_heatmap(df)
    plot_top_critical(df)
    plot_priority_donuts(df)
    plot_system_boxplots(df)
    plot_rul_urgency(df)
    plot_aircraft_radar(df)
    plot_ata_risk(df)
    plot_corrosion_bubble(df)

    print()
    print("  All 8 charts saved to output/")
    print("=" * 60)
    print()


if __name__ == "__main__":
    main()
