"""
Dimensionality reduction + density-based clustering.

Pipeline:
  embeddings (N, D) → UMAP (N, 15) → HDBSCAN → cluster labels (N,)

Key tuning decisions:
  - n_components=15: sweet spot for HDBSCAN; 50 is too high and causes
    HDBSCAN to merge well-separated topics into the noise bucket.
  - min_dist=0.0: maximises cluster compactness in UMAP space.
  - min_cluster_size = max(5, n // 80): produces ~8-15 topics for 500-2000
    responses. n//50 was too aggressive (merged real topics).
  - min_samples = max(2, min_cluster_size // 3): controls outlier sensitivity;
    lower = more points assigned to clusters rather than noise.
  - Noise reassignment uses HDBSCAN's own soft-cluster membership vectors
    (all_points_membership_vectors) rather than cosine centroid proximity,
    which respects the density structure the model already learned.
"""
import numpy as np
import hdbscan as hdbscan_lib
import umap

_RANDOM_STATE = 42
_MAX_CLUSTERS = 10


def reduce(embeddings: np.ndarray, n_components: int = 15) -> np.ndarray:
    """UMAP reduction. min_dist=0.0 tightens clusters for HDBSCAN."""
    reducer = umap.UMAP(
        n_components=n_components,
        metric="cosine",
        n_neighbors=15,
        min_dist=0.0,
        random_state=_RANDOM_STATE,
        low_memory=False,
    )
    return reducer.fit_transform(embeddings)


def cluster(reduced: np.ndarray, n_responses: int):
    """
    HDBSCAN clustering.

    min_cluster_size scales with corpus size but stays small enough to
    surface granular topics. min_samples is set low so fewer points are
    classified as noise before reassignment.
    """
    # Larger min_cluster_size → fewer, broader clusters.
    # n//50 gives ~20 for 1000 responses, naturally producing ≤10 topics
    # before the hard cap kicks in.
    min_cluster_size = max(10, n_responses // 50)
    min_samples = max(3, min_cluster_size // 4)

    clusterer = hdbscan_lib.HDBSCAN(
        min_cluster_size=min_cluster_size,
        min_samples=min_samples,
        metric="euclidean",
        cluster_selection_method="eom",
        prediction_data=True,
    )
    labels = clusterer.fit_predict(reduced)
    return labels, clusterer


def reassign_noise(labels: np.ndarray, clusterer) -> np.ndarray:
    """
    Reassign noise points (label == -1) using HDBSCAN's soft membership
    vectors, which respect the learned density structure.
    """
    labels = labels.copy()
    if not (labels == -1).any():
        return labels

    cluster_ids = sorted(set(labels) - {-1})
    if not cluster_ids:
        return np.zeros_like(labels)

    # Soft membership: shape (n_samples, n_clusters)
    membership = hdbscan_lib.all_points_membership_vectors(clusterer)

    noise_mask = labels == -1
    # argmax over membership gives the most-likely cluster index (0-based)
    best_cluster_idx = membership[noise_mask].argmax(axis=1)
    labels[noise_mask] = np.array(cluster_ids)[best_cluster_idx]
    return labels


def cap_clusters(labels: np.ndarray, embeddings: np.ndarray) -> np.ndarray:
    """
    If HDBSCAN produced more than _MAX_CLUSTERS, merge the smallest excess
    clusters into the nearest retained cluster (by centroid distance in the
    original embedding space).
    """
    unique = sorted(set(labels))
    if len(unique) <= _MAX_CLUSTERS:
        return labels

    # Keep the _MAX_CLUSTERS largest clusters; merge the rest
    counts = {c: int((labels == c).sum()) for c in unique}
    keep = sorted(unique, key=lambda c: counts[c], reverse=True)[:_MAX_CLUSTERS]
    keep_set = set(keep)

    centroids = np.stack([embeddings[labels == c].mean(axis=0) for c in keep])

    new_labels = labels.copy()
    for c in unique:
        if c in keep_set:
            continue
        mask = labels == c
        points = embeddings[mask]
        dists = np.linalg.norm(points[:, None, :] - centroids[None, :, :], axis=2)
        nearest_idx = dists.argmin(axis=1)
        new_labels[mask] = np.array(keep)[nearest_idx]

    return new_labels


def run_pipeline(embeddings: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """
    Full pipeline. Returns (labels, reduced_15d); labels has no -1 values
    and at most _MAX_CLUSTERS distinct values.
    """
    n = len(embeddings)
    n_components = min(15, n - 1)
    reduced = reduce(embeddings, n_components=n_components)
    raw_labels, clusterer = cluster(reduced, n)
    labels = reassign_noise(raw_labels, clusterer)
    labels = cap_clusters(labels, embeddings)
    return labels, reduced
