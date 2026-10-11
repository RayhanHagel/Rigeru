import sqlite3
import os
import uuid
import datetime
import random
from utilities.core.util_network import better_get
from bs4 import BeautifulSoup
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "korean_srs.db"))

HANGUL_CONSONANTS = [
    {"front": "ㄱ", "back": "g/k (giyeok)"}, {"front": "ㄴ", "back": "n (nieun)"}, {"front": "ㄷ", "back": "d/t (digeut)"},
    {"front": "ㄹ", "back": "r/l (rieul)"}, {"front": "ㅁ", "back": "m (mieum)"}, {"front": "ㅂ", "back": "b/p (bieup)"},
    {"front": "ㅅ", "back": "s (siot)"}, {"front": "ㅇ", "back": "ng / silent initial (ieung)"}, {"front": "ㅈ", "back": "j (jieut)"},
    {"front": "ㅊ", "back": "ch (chieut)"}, {"front": "ㅋ", "back": "k (kieuk)"}, {"front": "ㅌ", "back": "t (tieut)"},
    {"front": "ㅍ", "back": "p (pieup)"}, {"front": "ㅎ", "back": "h (hieut)"}
]

HANGUL_DOUBLE_CONSONANTS = [
    {"front": "ㄲ", "back": "kk (ssang-giyeok)"},
    {"front": "ㄸ", "back": "tt (ssang-digeut)"},
    {"front": "ㅃ", "back": "pp (ssang-bieup)"},
    {"front": "ㅆ", "back": "ss (ssang-siot)"},
    {"front": "ㅉ", "back": "jj (ssang-jieut)"}
]

HANGUL_BASIC_VOWELS = [
    {"front": "ㅏ", "back": "a"}, {"front": "ㅑ", "back": "ya"}, {"front": "ㅓ", "back": "eo"},
    {"front": "ㅕ", "back": "yeo"}, {"front": "ㅗ", "back": "o"}, {"front": "ㅛ", "back": "yo"},
    {"front": "ㅜ", "back": "u"}, {"front": "ㅠ", "back": "yu"}, {"front": "ㅡ", "back": "eu"},
    {"front": "ㅣ", "back": "i"}
]

HANGUL_COMPOUND_VOWELS = [
    {"front": "ㅐ", "back": "ae"},
    {"front": "ㅒ", "back": "yae"},
    {"front": "ㅔ", "back": "e"},
    {"front": "ㅖ", "back": "ye"},
    {"front": "ㅘ", "back": "wa"},
    {"front": "ㅙ", "back": "wae"},
    {"front": "ㅚ", "back": "oe"},
    {"front": "ㅝ", "back": "wo"},
    {"front": "ㅞ", "back": "we"},
    {"front": "ㅟ", "back": "wi"},
    {"front": "ㅢ", "back": "ui"}
]

HANGUL_ALL = HANGUL_CONSONANTS + HANGUL_DOUBLE_CONSONANTS + HANGUL_BASIC_VOWELS + HANGUL_COMPOUND_VOWELS
HANGUL_BASIC = HANGUL_ALL

DAILY_CONVERSATIONS = [
    # Greetings & Courtesies
    {"front": "안녕하세요", "back": "Hello (formal)"},
    {"front": "안녕", "back": "Hi / Bye (casual)"},
    {"front": "감사합니다", "back": "Thank you (formal)"},
    {"front": "고마워요", "back": "Thank you (polite)"},
    {"front": "죄송합니다", "back": "I am sorry (formal)"},
    {"front": "미안해요", "back": "I'm sorry (polite)"},
    {"front": "천만에요", "back": "You are welcome"},
    {"front": "실례합니다", "back": "Excuse me (formal)"},
    {"front": "저기요", "back": "Excuse me (getting attention)"},
    {"front": "잠시만요", "back": "Just a moment / Excuse me"},
    {"front": "안녕히 가세요", "back": "Goodbye (to someone leaving)"},
    {"front": "안녕히 계세요", "back": "Goodbye (to someone staying)"},
    {"front": "잘 가요", "back": "Go well / Bye (polite)"},
    {"front": "좋은 아침이에요", "back": "Good morning"},
    {"front": "좋은 하루 보내세요", "back": "Have a nice day"},
    {"front": "수고하셨습니다", "back": "Thank you for your hard work"},
    {"front": "수고하세요", "back": "Keep up the good work"},

    # Yes, No & Basic Responses
    {"front": "네", "back": "Yes"},
    {"front": "아니요", "back": "No"},
    {"front": "맞아요", "back": "That's right / Correct"},
    {"front": "아니에요", "back": "It's not / No problem"},
    {"front": "괜찮아요", "back": "It's okay / I am fine"},
    {"front": "좋아요", "back": "Good / Sounds good"},
    {"front": "알겠어요", "back": "I understand / Got it"},
    {"front": "몰라요", "back": "I don't know"},
    {"front": "이해했어요", "back": "I understood"},
    {"front": "정말이에요?", "back": "Really?"},
    {"front": "진짜요?", "back": "Seriously? / Really?"},
    {"front": "물론이죠", "back": "Of course"},
    {"front": "아마도요", "back": "Maybe / Probably"},

    # Introductions & Small Talk
    {"front": "이름이 뭐예요?", "back": "What is your name?"},
    {"front": "제 이름은 ... 이에요", "back": "My name is ..."},
    {"front": "만나서 반갑습니다", "back": "Nice to meet you"},
    {"front": "어느 나라 사람이에요?", "back": "Which country are you from?"},
    {"front": "저는 학생이에요", "back": "I am a student"},
    {"front": "저는 회사원이에요", "back": "I am an office worker"},
    {"front": "몇 살이에요?", "back": "How old are you?"},
    {"front": "취미가 뭐예요?", "back": "What is your hobby?"},
    {"front": "한국어 조금 할 수 있어요", "back": "I can speak a little Korean"},
    {"front": "한국어 공부하고 있어요", "back": "I am studying Korean"},
    {"front": "영어 할 수 있어요?", "back": "Can you speak English?"},
    {"front": "천천히 말씀해 주세요", "back": "Please speak slowly"},
    {"front": "다시 말씀해 주세요", "back": "Please say that again"},

    # Asking Questions & Location
    {"front": "이게 뭐예요?", "back": "What is this?"},
    {"front": "저게 뭐예요?", "back": "What is that over there?"},
    {"front": "어디에요?", "back": "Where is it?"},
    {"front": "화장실이 어디에요?", "back": "Where is the bathroom?"},
    {"front": "지하철역이 어디에 있어요?", "back": "Where is the subway station?"},
    {"front": "편의점이 어디에 있어요?", "back": "Where is the convenience store?"},
    {"front": "여기서 멀어요?", "back": "Is it far from here?"},
    {"front": "얼마나 걸려요?", "back": "How long does it take?"},
    {"front": "지금 몇 시예요?", "back": "What time is it now?"},
    {"front": "오늘 며칠이에요?", "back": "What date is it today?"},
    {"front": "왜 그래요?", "back": "What's wrong? / Why are you doing that?"},
    {"front": "무슨 일이에요?", "back": "What's going on?"},

    # Shopping & Prices
    {"front": "얼마예요?", "back": "How much is it?"},
    {"front": "이거 주세요", "back": "Please give me this"},
    {"front": "저거 보여주세요", "back": "Please show me that"},
    {"front": "카드 돼요?", "back": "Do you accept credit cards?"},
    {"front": "현금영수증 필요하세요?", "back": "Do you need a cash receipt?"},
    {"front": "봉투 필요하세요?", "back": "Do you need a bag?"},
    {"front": "봉투 주세요", "back": "Please give me a bag"},
    {"front": "너무 비싸요", "back": "It is too expensive"},
    {"front": "조금 깎아주세요", "back": "Please give me a discount"},
    {"front": "환불해 주세요", "back": "Please give me a refund"},
    {"front": "교환할 수 있어요?", "back": "Can I exchange this?"},

    # Restaurant & Dining
    {"front": "메뉴판 주세요", "back": "Please give me the menu"},
    {"front": "물 좀 주세요", "back": "Please give me some water"},
    {"front": "주문할게요", "back": "I'd like to order"},
    {"front": "추천해 주세요", "back": "Please give me a recommendation"},
    {"front": "이거 하나 주세요", "back": "Please give me one of this"},
    {"front": "맵지 않게 해주세요", "back": "Please make it not spicy"},
    {"front": "포장해 주세요", "back": "Please pack it to go / Takeout please"},
    {"front": "여기서 먹고 갈게요", "back": "I will eat here"},
    {"front": "잘 먹겠습니다", "back": "I will eat well (before eating)"},
    {"front": "잘 먹었습니다", "back": "I ate well / Thank you for the meal"},
    {"front": "맛있어요", "back": "It is delicious"},
    {"front": "맛없어요", "back": "It doesn't taste good"},
    {"front": "배고파요", "back": "I am hungry"},
    {"front": "목말라요", "back": "I am thirsty"},
    {"front": "배불러요", "back": "I am full"},
    {"front": "계산해 주세요", "back": "Check please / I'd like to pay"},

    # Feelings, States & Health
    {"front": "기분이 좋아요", "back": "I feel good"},
    {"front": "피곤해요", "back": "I am tired"},
    {"front": "졸려요", "back": "I am sleepy"},
    {"front": "아파요", "back": "It hurts / I am sick"},
    {"front": "머리가 아파요", "back": "I have a headache"},
    {"front": "감기 걸렸어요", "back": "I caught a cold"},
    {"front": "도와주세요", "back": "Please help me"},
    {"front": "걱정하지 마세요", "back": "Don't worry"},
    {"front": "축하해요", "back": "Congratulations"},
    {"front": "힘내세요", "back": "Cheer up / Stay strong"},
    {"front": "대박이에요", "back": "Awesome / Incredible"},
    {"front": "재미있어요", "back": "It is fun / interesting"},
    {"front": "심심해요", "back": "I am bored"},

    # Daily Routine & Appointments
    {"front": "지금 어디 가요?", "back": "Where are you going now?"},
    {"front": "집에 가요", "back": "I am going home"},
    {"front": "내일 봐요", "back": "See you tomorrow"},
    {"front": "다음에 봐요", "back": "See you next time"},
    {"front": "연락할게요", "back": "I will contact you"},
    {"front": "밥 먹었어요?", "back": "Did you eat? / How are you?"},
    {"front": "오늘 뭐 해요?", "back": "What are you doing today?"},
    {"front": "주말 잘 보내세요", "back": "Have a good weekend"},
    {"front": "날씨가 좋아요", "back": "The weather is nice"},
    {"front": "비가 와요", "back": "It is raining"},
    {"front": "너무 더워요", "back": "It is too hot"},
    {"front": "너무 추워요", "back": "It is too cold"}
]

def get_connection() -> sqlite3.Connection:
    """Creates and returns a connection to the Korean SRS SQLite database.

    Returns:
        sqlite3.Connection: Configured SQLite database connection with row factory.
    """
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db() -> None:
    """Initializes the database schema and seeds initial Hangul and conversation cards if empty.

    Returns:
        None
    """
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
    
    # Sync hangul cards if any missing
    now_str = datetime.datetime.now().isoformat()
    for item in HANGUL_ALL:
        c.execute("SELECT id FROM cards WHERE front = ? AND card_type = 'hangul'", (item['front'],))
        if not c.fetchone():
            c.execute("""
                INSERT INTO cards (id, front, back, card_type, next_review_date, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (str(uuid.uuid4()), item['front'], item['back'], 'hangul', now_str, now_str))

    # Sync conversation cards if any missing
    for item in DAILY_CONVERSATIONS:
        c.execute("SELECT id FROM cards WHERE front = ? AND card_type = 'conversation'", (item['front'],))
        if not c.fetchone():
            c.execute("""
                INSERT INTO cards (id, front, back, card_type, next_review_date, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (str(uuid.uuid4()), item['front'], item['back'], 'conversation', now_str, now_str))
            
    conn.commit()
    conn.close()

def add_custom_card(front: str, back: str, card_type: str = "vocab") -> dict[str, Any]:
    """Adds a new user-defined card to the database.

    Args:
        front (str): Front prompt (e.g., cloze sentence with [...] or vocabulary).
        back (str): Back answer (e.g., missing word or translation).
        card_type (str): Type of card ('cloze', 'vocab', 'conversation', 'hangul').

    Returns:
        dict[str, Any]: The newly created card.
    """
    conn = get_connection()
    c = conn.cursor()
    card_id = str(uuid.uuid4())
    now_str = datetime.datetime.now().isoformat()
    c.execute("""
        INSERT INTO cards (id, front, back, card_type, next_review_date, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (card_id, front.strip(), back.strip(), card_type.strip(), now_str, now_str))
    conn.commit()
    conn.close()
    return {
        "id": card_id,
        "front": front.strip(),
        "back": back.strip(),
        "card_type": card_type.strip(),
        "next_review_date": now_str,
        "created_at": now_str
    }

def delete_card_by_id(card_id: str) -> bool:
    """Deletes a card and its associated review logs by ID.

    Args:
        card_id (str): The ID of the card to delete.

    Returns:
        bool: True if card was deleted, False otherwise.
    """
    conn = get_connection()
    c = conn.cursor()
    c.execute("DELETE FROM review_logs WHERE card_id = ?", (card_id,))
    c.execute("DELETE FROM cards WHERE id = ?", (card_id,))
    deleted = c.rowcount > 0
    conn.commit()
    conn.close()
    return deleted

def get_due_cards(limit: int = 20) -> list[dict[str, Any]]:
    """Fetches cards due for review sorted by scheduled review date.

    Args:
        limit (int): Maximum number of cards to retrieve. Defaults to 20.

    Returns:
        list[dict[str, Any]]: List of dictionary representations of due cards.
    """
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

def get_all_cards() -> list[dict[str, Any]]:
    """Retrieves all flashcards stored in the database.

    Returns:
        list[dict[str, Any]]: List of all flashcard records as dictionaries.
    """
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM cards")
    cards = [dict(row) for row in c.fetchall()]
    conn.close()
    return cards

def review_card(card_id: str, quality: int) -> dict[str, Any] | None:
    """Updates a card's SRS interval and classification based on cumulative statistics.

    Review uses binary grading:
        quality 0: Fail (incorrect)
        quality 1 (or >= 4): Succeed (correct)

    Mastery classification is computed from statistics:
        - Total reviews (N)
        - Success rate (accuracy %)
        - Consecutive / total successes

    Thresholds:
        - Easy: Total reviews >= 6 and success rate >= 85%
        - Good: Total reviews >= 3 and success rate >= 70%
        - Learning: Otherwise
    """
    is_success = bool(quality >= 1)
    score_val = 5 if is_success else 0

    conn = get_connection()
    c = conn.cursor()
    
    c.execute("SELECT * FROM cards WHERE id = ?", (card_id,))
    row = c.fetchone()
    if not row:
        conn.close()
        return None
        
    card = dict(row)
    now = datetime.datetime.now()
    
    # Log the review first so stats reflect this attempt
    c.execute("""
        INSERT INTO review_logs (id, card_id, score, review_date)
        VALUES (?, ?, ?, ?)
    """, (str(uuid.uuid4()), card_id, score_val, now.isoformat()))
    
    # Query cumulative statistics for this card
    c.execute("SELECT COUNT(*) as total, SUM(CASE WHEN score >= 3 THEN 1 ELSE 0 END) as successes FROM review_logs WHERE card_id = ?", (card_id,))
    stat_row = c.fetchone()
    total_reviews = stat_row["total"] or 1
    total_successes = stat_row["successes"] or (1 if is_success else 0)
    success_rate = (total_successes / total_reviews) * 100.0

    # Determine mastery tier & interval based on statistics
    repetition = card['repetition']
    ease_factor = card['ease_factor'] or 2.5

    if is_success:
        repetition += 1
        if total_reviews >= 6 and success_rate >= 85.0:
            classification = "easy"
            interval = max(14.0, repetition * ease_factor * 2.2)
        elif total_reviews >= 3 and success_rate >= 70.0:
            classification = "good"
            interval = max(4.0, repetition * ease_factor * 1.4)
        else:
            classification = "learning"
            interval = max(1.0, 1.0 * repetition)
    else:
        # Failure: reset interval to 1 day, drop repetition by half
        repetition = max(0, repetition // 2)
        interval = 1.0
        classification = "learning"

    next_review = now + datetime.timedelta(days=interval)
    next_review_str = next_review.isoformat()
    
    # Update Card
    c.execute("""
        UPDATE cards 
        SET interval = ?, repetition = ?, ease_factor = ?, next_review_date = ?
        WHERE id = ?
    """, (interval, repetition, ease_factor, next_review_str, card_id))
    
    conn.commit()
    conn.close()
    
    return {
        "id": card_id,
        "interval": interval,
        "repetition": repetition,
        "classification": classification,
        "success_rate": round(success_rate, 1),
        "total_reviews": total_reviews,
        "next_review_date": next_review_str
    }

def get_stats() -> dict[str, Any]:
    """Computes SRS study metrics, retention rates, weak cards, and daily activity.

    Returns:
        dict[str, Any]: Aggregated study performance and activity metrics.
    """
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

def translate_to_english(text: str) -> str:
    """Translates Korean text to English using Google Translate endpoint or falls back cleanly."""
    if not text.strip():
        return ""
    try:
        import urllib.parse
        url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=en&dt=t&q={urllib.parse.quote(text)}"
        res = better_get(url, use_default_headers=True, timeout=5)
        if res and res.status_code == 200:
            data = res.json()
            return "".join([part[0] for part in data[0] if part and part[0]]).strip()
    except Exception as e:
        print(f"Translation error: {e}")
    return ""

def scrape_wikipedia_cloze() -> dict[str, Any] | None:
    """Scrapes a random Korean Wikipedia article to create a cloze card with English translation.

    Returns:
        dict[str, Any] | None: New cloze flashcard dictionary if successfully created, else None.
    """
    try:
        url = "https://ko.wikipedia.org/wiki/특수:임의문서"
        response = better_get(url, timeout=10, use_default_headers=True)
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
        
        # Cloze creation: pick a random word of length > 1
        import re
        words = [w for w in sentence.split() if len(w) > 1 and not bool(re.search(r'[0-9a-zA-Z]', w))]
        if not words:
            return None
            
        target_word = random.choice(words)
        
        # We replace target_word with [...]
        korean_cloze = sentence.replace(target_word, "[...]")
        
        # Translate full sentence and target word
        sentence_translation = translate_to_english(sentence)
        word_translation = translate_to_english(target_word)
        
        # Format Front: Korean cloze + English translation prompt
        if sentence_translation:
            front_display = f"{korean_cloze}\n({sentence_translation})"
        else:
            front_display = korean_cloze

        # Format Back: Target word + English definition/translation
        if word_translation:
            back_display = f"{target_word} ({word_translation})"
        else:
            back_display = target_word
        
        # Save to DB
        conn = get_connection()
        c = conn.cursor()
        card_id = str(uuid.uuid4())
        now_str = datetime.datetime.now().isoformat()
        
        c.execute("""
            INSERT INTO cards (id, front, back, card_type, next_review_date, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (card_id, front_display, back_display, 'cloze', now_str, now_str))
        
        conn.commit()
        conn.close()
        
        return {
            "id": card_id,
            "front": front_display,
            "back": back_display,
            "card_type": "cloze"
        }
    except Exception as e:
        print(f"Error scraping wikipedia: {e}")
        return None

# Initialize DB on load
init_db()
