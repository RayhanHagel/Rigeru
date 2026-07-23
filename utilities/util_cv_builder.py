def generate_cv_pdf(data: dict, template: str) -> tuple[bool, bytes | str]:
    """
    Generates an ATS-friendly PDF Resume based on the provided dictionary data.
    Returns a tuple: (success_boolean, pdf_bytes_or_error_message).
    """
    try:
        from fpdf import FPDF  # Lazy Load
    except ImportError:
        return False, "Missing dependency. Please run: `pip install fpdf2`"

    if not data:
        return False, "No data provided for generation."

    try:
        pdf = FPDF()
        pdf.add_page()
        pdf.set_auto_page_break(auto=True, margin=15)

        # --- CLASSIC TEMPLATE ---
        if template == "Classic":
            pdf.set_font("Times", "B", 24)
            pdf.cell(0, 10, data.get("name", ""), ln=True, align="C")
            
            pdf.set_font("Times", "", 12)
            contact_info = " | ".join(filter(None, [data.get('email'), data.get('phone'), data.get('linkedin')]))
            pdf.cell(0, 10, contact_info, ln=True, align="C")
            pdf.ln(5)

            if data.get("summary"):
                pdf.set_font("Times", "B", 14)
                pdf.cell(0, 8, "Professional Summary", border="B", ln=True)
                pdf.ln(2)
                pdf.set_font("Times", "", 12)
                pdf.multi_cell(0, 6, data.get("summary", ""))
                pdf.ln(5)

            if data.get("experience"):
                pdf.set_font("Times", "B", 14)
                pdf.cell(0, 8, "Experience", border="B", ln=True)
                pdf.ln(2)
                for exp in data["experience"]:
                    pdf.set_font("Times", "B", 12)
                    pdf.cell(0, 6, f"{exp.get('title', '')} - {exp.get('company', '')}", ln=True)
                    pdf.set_font("Times", "I", 11)
                    pdf.cell(0, 6, f"{exp.get('dates', '')}", ln=True)
                    pdf.set_font("Times", "", 12)
                    # Handle multiline descriptions nicely
                    desc_lines = exp.get('description', '').split('\n')
                    for line in desc_lines:
                        if line.strip():
                            pdf.multi_cell(0, 6, line.strip())
                    pdf.ln(3)
                pdf.ln(2)

            if data.get("education"):
                pdf.set_font("Times", "B", 14)
                pdf.cell(0, 8, "Education", border="B", ln=True)
                pdf.ln(2)
                for edu in data["education"]:
                    pdf.set_font("Times", "B", 12)
                    pdf.cell(0, 6, f"{edu.get('degree', '')} - {edu.get('institution', '')}", ln=True)
                    pdf.set_font("Times", "", 12)
                    pdf.cell(0, 6, f"{edu.get('year', '')}", ln=True)
                    pdf.ln(2)

            if data.get("skills"):
                pdf.set_font("Times", "B", 14)
                pdf.cell(0, 8, "Skills", border="B", ln=True)
                pdf.ln(2)
                pdf.set_font("Times", "", 12)
                pdf.multi_cell(0, 6, data.get("skills", ""))

        # --- MODERN TEMPLATE ---
        elif template == "Modern":
            pdf.set_font("Helvetica", "B", 22)
            pdf.set_text_color(44, 62, 80)
            pdf.cell(0, 10, data.get("name", "").upper(), ln=True, align="L")
            
            pdf.set_font("Helvetica", "", 10)
            pdf.set_text_color(127, 140, 141)
            contact_info = "  •  ".join(filter(None, [data.get('email'), data.get('phone'), data.get('linkedin')]))
            pdf.cell(0, 6, contact_info, ln=True, align="L")
            pdf.ln(8)
            
            pdf.set_text_color(0, 0, 0) # Reset to black

            if data.get("summary"):
                pdf.set_font("Helvetica", "B", 12)
                pdf.set_text_color(41, 128, 185) # Blue headers
                pdf.cell(0, 6, "SUMMARY", ln=True)
                pdf.set_text_color(0, 0, 0)
                pdf.set_font("Helvetica", "", 11)
                pdf.multi_cell(0, 5, data.get("summary", ""))
                pdf.ln(5)

            if data.get("experience"):
                pdf.set_font("Helvetica", "B", 12)
                pdf.set_text_color(41, 128, 185)
                pdf.cell(0, 6, "EXPERIENCE", ln=True)
                pdf.set_text_color(0, 0, 0)
                for exp in data["experience"]:
                    pdf.set_font("Helvetica", "B", 11)
                    pdf.cell(0, 6, f"{exp.get('title', '')} | {exp.get('company', '')}", ln=True)
                    pdf.set_font("Helvetica", "I", 10)
                    pdf.set_text_color(127, 140, 141)
                    pdf.cell(0, 5, f"{exp.get('dates', '')}", ln=True)
                    pdf.set_text_color(0, 0, 0)
                    pdf.set_font("Helvetica", "", 11)
                    desc_lines = exp.get('description', '').split('\n')
                    for line in desc_lines:
                        if line.strip():
                            pdf.multi_cell(0, 5, line.strip())
                    pdf.ln(3)

            if data.get("education"):
                pdf.set_font("Helvetica", "B", 12)
                pdf.set_text_color(41, 128, 185)
                pdf.cell(0, 6, "EDUCATION", ln=True)
                pdf.set_text_color(0, 0, 0)
                for edu in data["education"]:
                    pdf.set_font("Helvetica", "B", 11)
                    pdf.cell(0, 6, f"{edu.get('degree', '')}", ln=True)
                    pdf.set_font("Helvetica", "", 11)
                    pdf.cell(0, 5, f"{edu.get('institution', '')} ({edu.get('year', '')})", ln=True)
                    pdf.ln(2)

            if data.get("skills"):
                pdf.set_font("Helvetica", "B", 12)
                pdf.set_text_color(41, 128, 185)
                pdf.cell(0, 6, "SKILLS", ln=True)
                pdf.set_text_color(0, 0, 0)
                pdf.set_font("Helvetica", "", 11)
                pdf.multi_cell(0, 5, data.get("skills", ""))

        # Output the document to a bytes array
        pdf_bytes = pdf.output(dest='S')
        return True, bytes(pdf_bytes)
        
    except Exception as e:
        return False, f"CV Generation failed: {str(e)}"