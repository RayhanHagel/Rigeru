import io
import re
import pytesseract
from PIL import Image

def extract_receipt_data(image_bytes: bytes) -> tuple[bool, dict | str]:
    """
    Extracts text from a receipt image locally and attempts to parse 
    the total amount and date.
    """
    try:
        # Load image
        img = Image.open(io.BytesIO(image_bytes))
        
        # Convert to grayscale for better OCR accuracy
        img = img.convert('L')
        
        # Perform local OCR
        extracted_text = pytesseract.image_to_string(img)
        
        if not extracted_text.strip():
            return False, "No text could be extracted. Please try a clearer image."

        # Parse Date (Common formats: MM/DD/YYYY, YYYY-MM-DD, DD-MM-YYYY)
        date_pattern = r'\b(\d{1,4}[-/]\d{1,2}[-/]\d{1,4})\b'
        dates_found = re.findall(date_pattern, extracted_text)
        receipt_date = dates_found[0] if dates_found else "Not Found"

        # Parse Total Amount (Looks for $ or just decimal numbers near the word 'Total')
        # This is a basic heuristics parser
        total_pattern = r'(?i)total[\s:=]*\$?\s*(\d{1,5}\.\d{2})'
        totals_found = re.findall(total_pattern, extracted_text)
        
        # If 'total' keyword isn't found, just grab the largest currency-like number
        if not totals_found:
            currency_pattern = r'\$?\s*(\d{1,5}\.\d{2})'
            all_amounts = [float(x) for x in re.findall(currency_pattern, extracted_text)]
            total_amount = f"${max(all_amounts):.2f}" if all_amounts else "Not Found"
        else:
            total_amount = f"${float(totals_found[-1]):.2f}" # Usually the last 'total' is the final one

        return True, {
            "date": receipt_date,
            "total": total_amount,
            "raw_text": extracted_text
        }

    except pytesseract.TesseractNotFoundError:
        return False, "Tesseract is not installed on your system. Please install Tesseract-OCR."
    except Exception as e:
        return False, f"Error processing receipt: {str(e)}"