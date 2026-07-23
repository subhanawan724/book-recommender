from pathlib import Path
import pandas as pd
from langchain_core.documents import Document
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings

BASE_DIR = Path(__file__).resolve().parent
CSV_PATH = BASE_DIR / "data" / "books_cleaned.csv"
CHROMA_DIR = BASE_DIR / "data" / "my_book_vector_db"

books_df = pd.read_csv(CSV_PATH)
books_df["isbn13"] = books_df["isbn13"].astype(str)
books_df = books_df.dropna(subset=["description"])

documents = [
    Document(
        page_content=str(row["description"]),
        metadata={"isbn13": row["isbn13"], "title": row["title"]},
    )
    for _, row in books_df.iterrows()
]

print(f"Prepared {len(documents)} individual book documents — one per book, no merging.")

embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

db_books = Chroma.from_documents(
    documents=documents,
    embedding=embeddings,
    persist_directory=str(CHROMA_DIR),
)

print("✅ Rebuilt vector DB —", db_books._collection.count(), "individual book embeddings saved.")
