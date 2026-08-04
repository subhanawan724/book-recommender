from pathlib import Path
import pandas as pd
from langchain_chroma import Chroma


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
CSV_PATH = DATA_DIR / "books_cleaned.csv"
CHROMA_DIR = DATA_DIR / "my_book_vector_db"
STATIC_DIR = BASE_DIR / "static"
books_df = pd.read_csv(CSV_PATH)
books_df["isbn13"] = books_df["isbn13"].astype(str)


import requests

class HFInferenceEmbeddings:
    def __init__(self, api_token, model_name="sentence-transformers/all-MiniLM-L6-v2"):
        self.api_url = f"https://api-inference.huggingface.co/pipeline/feature-extraction/{model_name}"
        self.headers = {"Authorization": f"Bearer {api_token}"}

    def embed_query(self, text):
        response = requests.post(self.api_url, headers=self.headers, json={"inputs": text})
        return response.json()

    def embed_documents(self, texts):
        return [self.embed_query(t) for t in texts]

CATEGORIES = sorted(
    c for c in books_df["categories"].dropna().unique().tolist() if isinstance(c, str)
)
import os
embeddings = HFInferenceEmbeddings(api_token=os.environ["HF_API_TOKEN"])
#embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

db_books = Chroma(
    persist_directory=str(CHROMA_DIR),
    embedding_function=embeddings,
)
print(f"Loaded {len(books_df)} books from the CSV")
print(f"Vector DB ready — collection has {db_books._collection.count()} embedded chunks")

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
app = FastAPI(title="Book Recommender API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
class RecommendRequest(BaseModel):
    query: str
    top_k: int = 10
    category: Optional[str] = None
    min_rating: Optional[float] = None
class BookResult(BaseModel):
    isbn13: str
    title: str
    authors: Optional[str] = None
    category: Optional[str] = None
    thumbnail: Optional[str] = None
    description: Optional[str] = None
    published_year: Optional[int] = None
    average_rating: Optional[float] = None
    num_pages: Optional[int] = None
    match_score: float
@app.get("/api/categories")
def get_categories():
    return {"categories": CATEGORIES,"total_books": len(books_df)}


@app.get("/api/featured", response_model=list[BookResult])
def get_featured(count: int = 10):
    sample = books_df.dropna(subset=["thumbnail"]).sample(n=min(count, len(books_df)))

    def clean_int(v):
        return int(v) if pd.notna(v) else None

    def clean_float(v):
        return float(v) if pd.notna(v) else None

    results = []
    for _, row in sample.iterrows():
        results.append(
            BookResult(
                isbn13=row["isbn13"],
                title=row["title"],
                authors=row.get("authors") if pd.notna(row.get("authors")) else None,
                category=row.get("categories") if pd.notna(row.get("categories")) else None,
                thumbnail=row.get("thumbnail"),
                description=row.get("description") if pd.notna(row.get("description")) else None,
                published_year=clean_int(row.get("published_year")),
                average_rating=clean_float(row.get("average_rating")),
                num_pages=clean_int(row.get("num_pages")),
                match_score=0,
            )
        )
    return results


@app.post("/api/recommend", response_model=list[BookResult])
def recommend(req: RecommendRequest):
    if not req.query or not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
    raw_hits = db_books.similarity_search_with_score(req.query, k=30)

    candidates = []
    for doc, distance in raw_hits:
        isbn = doc.metadata.get("isbn13")
        if not isbn:
            continue
        row = books_df.loc[books_df["isbn13"] == isbn]
        if row.empty:
            continue
        row = row.iloc[0]

        if req.category and req.category != "All" and row.get("categories") != req.category:
            continue
        if req.min_rating and not (pd.notna(row.get("average_rating")) and row["average_rating"] >= req.min_rating):
            continue

        candidates.append((row, distance))

    if not candidates:
        return []

    distances = [d for _, d in candidates]
    d_min, d_max = min(distances), max(distances)
    spread = (d_max - d_min) or 1e-6

    results = []
    for row, distance in candidates[: req.top_k]:
        score = 100 * (1 - (distance - d_min) / spread)
        score = max(0.0, min(100.0, score))

        def clean_int(v):
            return int(v) if pd.notna(v) else None

        def clean_float(v):
            return float(v) if pd.notna(v) else None

        results.append(
            BookResult(
                isbn13=row["isbn13"],
                title=row["title"],
                authors=row.get("authors") if pd.notna(row.get("authors")) else None,
                category=row.get("categories") if pd.notna(row.get("categories")) else None,
                thumbnail=row.get("thumbnail") if pd.notna(row.get("thumbnail")) else None,
                description=row.get("description") if pd.notna(row.get("description")) else None,
                published_year=clean_int(row.get("published_year")),
                average_rating=clean_float(row.get("average_rating")),
                num_pages=clean_int(row.get("num_pages")),
                match_score=round(score, 1),
            )
        )
    return results
@app.get("/")
def serve_index():
    return FileResponse(STATIC_DIR / "index.html")


app.mount("/", StaticFiles(directory=str(STATIC_DIR)), name="static")
    
