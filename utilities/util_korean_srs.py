import sqlite3
import os
import uuid
import datetime
import random
from utilities.util_network import better_get
from bs4 import BeautifulSoup
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "korean_srs.db")

HANGUL_BASIC = [
    {"front": "ㄱ", "back": "g/k"}, {"front": "ㄴ", "back": "n"}, {"front": "ㄷ", "back": "d/t"},
    {"front": "ㄹ", "back": "r/l"}, {"front": "ㅁ", "back": "m"}, {"front": "ㅂ", "back": "b/p"},
    {"front": "ㅅ", "back": "s"}, {"front": "ㅇ", "back": "ng (silent at start)"}, {"front": "ㅈ", "back": "j"},
    {"front": "ㅊ", "back": "ch"}, {"front": "ㅋ", "back": "k"}, {"front": "ㅌ", "back": "t"},
    {"front": "ㅍ", "back": "p"}, {"front": "ㅎ", "back": "h"},
    {"front": "ㅏ", "back": "a"}, {"front": "ㅑ", "back": "ya"}, {"front": "ㅓ", "back": "eo"},
    {"front": "ㅕ", "back": "yeo"}, {"front": "ㅗ", "back": "o"}, {"front": "ㅛ", "back": "yo"},
    {"front": "ㅜ", "back": "u"}, {"front": "ㅠ", "back": "yu"}, {"front": "ㅡ", "back": "eu"},
    {"front": "ㅣ", "back": "i"}
]

DAILY_CONVERSATIONS = [
    {"front": "안녕하세요", "back": "Hello (formal)"},
    {"front": "감사합니다", "back": "Thank you (formal)"},
    {"front": "죄송합니다", "back": "I am sorry (formal)"},
    {"front": "네", "back": "Yes"},
    {"front": "아니요", "back": "No"},
    {"front": "이름이 뭐예요?", "back": "What is your name?"},
    {"front": "만나서 반갑습니다", "back": "Nice to meet you"},
    {"front": "얼마예요?", "back": "How much is it?"},
    {"front": "어디에요?", "back": "Where is it?"},
    {"front": "화장실이 어디에요?", "back": "Where is the bathroom?"}
]

def get_connection():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    c = conn.cursor()
    
    # Cards Table
    c.execute("""
        CREATE TABLE IF NOT EXISTS cards (
            id TEXT PRIMARY KEY,
            front TEXT NOT NULL,
            back TEXT NOT NULL,
            card_type TEXT DEFAULT 'vocab',
            interval REAL DEFAULT 0,
            repetition INTEGER DEFAULT 0,
            ease_factor REAL DEFAULT 2.5,
            next_review_date TEXT,
            created_at TEXT
        )
    """)
    
    # Review Logs for Stats
    c.execute("""
        CREATE TABLE IF NOT EXISTS review_logs (
            id TEXT PRIMARY KEY,
            card_id TEXT NOT NULL,
            score INTEGER NOT NULL,
            review_date TEXT NOT NULL,
            FOREIGN KEY (card_id) REFERENCES cards(id)
        )
    """)
    
    conn.commit()
    
    # Check if cards exist
    c.execute("SELECT COUNT(*) FROM cards")
    if c.fetchone()[0] == 0:
        now_str = datetime.datetime.now().isoformat()
        
        for item in HANGUL_BASIC:
            c.execute("""
                INSERT INTO cards (id, front, back, card_type, next_review_date, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (str(uuid.uuid4()), item['front'], item['back'], 'hangul', now_str, now_str))
            
        for item in DAILY_CONVERSATIONS:
            c.execute("""
                INSERT INTO cards (id, front, back, card_type, next_review_date, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (str(uuid.uuid4()), item['front'], item['back'], 'conversation', now_str, now_str))
            
        conn.commit()
        
    conn.close()

def get_due_cards(limit: int = 20) -> List[Dict]:
    conn = get_connection()
    c = conn.cursor()
    now_str = datetime.datetime.now().isoformat()
    
    c.execute("""
        SELECT * FROM cards 
        WHERE next_review_date <= ? 
        ORDER BY next_review_date ASC
        LIMIT ?
    """, (now_str, limit))
    
    cards = [dict(row) for row in c.fetchall()]
    conn.close()
    return cards

def get_all_cards() -> List[Dict]:
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM cards")
    cards = [dict(row) for row in c.fetchall()]
    conn.close()
    return cards

def review_card(card_id: str, quality: int):
    # quality: 0-5 (0: complete blackout, 5: perfect response)
    # Mapping we use: 0 = Fail, 3 = Hard, 4 = Good, 5 = Easy
    conn = get_connection()
    c = conn.cursor()
    
    c.execute("SELECT * FROM cards WHERE id = ?", (card_id,))
    row = c.fetchone()
    if not row:
        conn.close()
        return None
        
    card = dict(row)
    interval = card['interval']
    repetition = card['repetition']
    ease_factor = card['ease_factor']
    
    if quality < 3:
        repetition = 0
        interval = 1
    else:
        if repetition == 0:
            interval = 1
        elif repetition == 1:
            interval = 6
        else:
            interval = interval * ease_factor
        repetition += 1
        
    ease_factor = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    ease_factor = max(1.3, ease_factor)
    
    now = datetime.datetime.now()
    next_review = now + datetime.timedelta(days=interval)
    next_review_str = next_review.isoformat()
    
    # Update Card
    c.execute("""
        UPDATE cards 
        SET interval = ?, repetition = ?, ease_factor = ?, next_review_date = ?
        WHERE id = ?
    """, (interval, repetition, ease_factor, next_review_str, card_id))
    
    # Log Review
    c.execute("""
        INSERT INTO review_logs (id, card_id, score, review_date)
        VALUES (?, ?, ?, ?)
    """, (str(uuid.uuid4()), card_id, quality, now.isoformat()))
    
    conn.commit()
    conn.close()
    
    return {
        "id": card_id,
        "interval": interval,
        "repetition": repetition,
        "ease_factor": ease_factor,
        "next_review_date": next_review_str
    }

def get_stats() -> Dict:
    conn = get_connection()
    c = conn.cursor()
    
    now = datetime.datetime.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    week_start = (now - datetime.timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    
    c.execute("SELECT COUNT(*) FROM review_logs WHERE review_date >= ?", (today_start,))
    reviews_today = c.fetchone()[0]
    
    c.execute("SELECT COUNT(*) FROM review_logs WHERE review_date >= ?", (week_start,))
    reviews_week = c.fetchone()[0]
    
    c.execute("SELECT COUNT(*) FROM cards")
    total_cards = c.fetchone()[0]
    
    c.execute("SELECT COUNT(*) FROM cards WHERE repetition > 0")
    learned_cards = c.fetchone()[0]
    
    c.execute("SELECT COUNT(*) FROM cards WHERE next_review_date <= ?", (now.isoformat(),))
    due_cards = c.fetchone()[0]
    
    # Get weak cards (most fails recently)
    c.execute("""
        SELECT c.front, c.back, COUNT(r.id) as fails 
        FROM cards c
        JOIN review_logs r ON c.id = r.card_id
        WHERE r.score < 3
        GROUP BY c.id
        ORDER BY fails DESC
        LIMIT 5
    """)
    weak_cards = [{"front": r["front"], "back": r["back"], "fails": r["fails"]} for r in c.fetchall()]
    
    # Activity by day (last 7 days)
    activity = []
    for i in range(7):
        day = (now - datetime.timedelta(days=6-i)).date()
        day_start = day.strftime("%Y-%m-%dT00:00:00")
        day_end = day.strftime("%Y-%m-%dT23:59:59")
        c.execute("SELECT COUNT(*) FROM review_logs WHERE review_date BETWEEN ? AND ?", (day_start, day_end))
        activity.append({"date": day.strftime("%m-%d"), "count": c.fetchone()[0]})
    
    conn.close()
    return {
        "reviews_today": reviews_today,
        "reviews_week": reviews_week,
        "total_cards": total_cards,
        "learned_cards": learned_cards,
        "due_cards": due_cards,
        "weak_cards": weak_cards,
        "activity": activity
    }

def scrape_wikipedia_cloze():
    """Scrapes a random Korean Wikipedia article to create a cloze card."""
    try:
        url = "https://ko.wikipedia.org/wiki/특수:임의문서"
        response = better_get(url, timeout=10)
        if response is None: return None
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Get first few paragraphs
        content_div = soup.find('div', {'id': 'mw-content-text'})
        if not content_div:
            return None
            
        paragraphs = content_div.find_all('p')
        valid_sentences = []
        
        for p in paragraphs:
            text = p.get_text().strip()
            if text and len(text) > 30 and len(text) < 150:
                # Basic cleaning
                import re
                text = re.sub(r'\[\d+\]', '', text)  # Remove citations
                valid_sentences.append(text)
                
        if not valid_sentences:
            return None
            
        sentence = random.choice(valid_sentences)
        
        # Naive cloze creation: pick a random word of length > 1
        import re
        words = [w for w in sentence.split() if len(w) > 1 and not bool(re.search(r'[0-9a-zA-Z]', w))]
        if not words:
            return None
            
        target_word = random.choice(words)
        
        # We replace target_word with [...]
        front_cloze = sentence.replace(target_word, "[...]")
        
        # Save to DB
        conn = get_connection()
        c = conn.cursor()
        card_id = str(uuid.uuid4())
        now_str = datetime.datetime.now().isoformat()
        
        c.execute("""
            INSERT INTO cards (id, front, back, card_type, next_review_date, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (card_id, front_cloze, target_word, 'cloze', now_str, now_str))
        
        conn.commit()
        conn.close()
        
        return {
            "id": card_id,
            "front": front_cloze,
            "back": target_word,
            "card_type": "cloze"
        }
    except Exception as e:
        print(f"Error scraping wikipedia: {e}")
        return None

# Initialize DB on load
init_db()
