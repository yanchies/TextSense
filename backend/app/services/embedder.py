"""
Local embedding via sentence-transformers.
Model is loaded once and cached for the lifetime of the process.
"""
from functools import lru_cache

import numpy as np
from sentence_transformers import SentenceTransformer

MODEL_NAME = "all-MiniLM-L6-v2"


@lru_cache(maxsize=1)
def _get_model() -> SentenceTransformer:
    """Load model once; subsequent calls return the cached instance."""
    return SentenceTransformer(MODEL_NAME)


def embed(texts: list[str], batch_size: int = 64) -> np.ndarray:
    """
    Return an (N, D) float32 array of embeddings.
    Normalised so cosine similarity == dot product.
    """
    model = _get_model()
    embeddings = model.encode(
        texts,
        batch_size=batch_size,
        show_progress_bar=False,
        normalize_embeddings=True,
        convert_to_numpy=True,
    )
    return embeddings.astype(np.float32)
