"""Re-plot the CP 1919 (PSR B1919+21) pulse stack.

Data: 80 successive pulses, 300 intensity samples each,
digitised from Harold D. Craft Jr.'s 1970 Cornell PhD thesis.
"""
import numpy as np
import matplotlib.pyplot as plt

data = np.loadtxt("pulsar.csv", delimiter=",")   # shape (80, 300)
n_pulses, n_samples = data.shape

fig, ax = plt.subplots(figsize=(7, 9))
fig.patch.set_facecolor("black")
ax.set_facecolor("black")

x = np.arange(n_samples)
overlap = 1.4          # vertical spacing between traces
scale = 0.14           # intensity scaling

# Draw from the back (first pulse, top) to the front (last pulse, bottom),
# filling each trace with black so nearer lines occlude farther ones.
for i, pulse in enumerate(data):
    y = -i * overlap + pulse * scale
    ax.fill_between(x, y, -n_pulses * overlap, color="black", zorder=i)
    ax.plot(x, y, color="white", linewidth=0.9, zorder=i)

ax.set_xlim(-40, n_samples + 40)
ax.set_ylim(-n_pulses * overlap - 2, data[0].max() * scale + 4)
ax.axis("off")
plt.tight_layout()
plt.savefig("cp1919_replot.png", dpi=200, facecolor="black", bbox_inches="tight")
print("saved")
