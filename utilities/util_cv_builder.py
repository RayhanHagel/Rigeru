import os
import subprocess
import tempfile

def generate_cv_pdf(data: dict, template: str) -> tuple[bool, bytes | str]:
    """
    Generates an ATS-friendly PDF Resume based on the provided dictionary data.
    Returns a tuple: (success_boolean, pdf_bytes_or_error_message).
    """
    if not data:
        return False, "No data provided for generation."

    if template.startswith("LaTeX"):
        return _generate_latex_cv(data, template)
    
    return _generate_fpdf_cv(data, template)

def _generate_latex_cv(data: dict, template: str) -> tuple[bool, bytes | str]:
    # Escape latex special chars
    def escape_tex(text):
        if not text: return ""
        text = str(text)
        chars = {
            '&': r'\&', '%': r'\%', '$': r'\$', '#': r'\#', '_': r'\_',
            '{': r'\{', '}': r'\}', '~': r'\textasciitilde{}', '^': r'\textasciicircum{}', '\\': r'\textbackslash{}'
        }
        for k, v in chars.items():
            text = text.replace(k, v)
        return text

    name = escape_tex(data.get("name", ""))
    email = escape_tex(data.get("email", ""))
    phone = escape_tex(data.get("phone", ""))
    linkedin = escape_tex(data.get("linkedin", ""))
    
    contact_parts = []
    if phone: contact_parts.append(phone)
    if email: contact_parts.append(rf"\href{{mailto:{email}}}{{{email}}}")
    if linkedin: contact_parts.append(rf"\href{{https://{linkedin}}}{{{linkedin}}}")
    contact_info = " $\\vert$ ".join(contact_parts)

    summary = escape_tex(data.get("summary", ""))
    
    exp_tex = ""
    if data.get("experience"):
        exp_tex += r"\section*{Experience}" + "\n"
        for exp in data["experience"]:
            title = escape_tex(exp.get('title', ''))
            company = escape_tex(exp.get('company', ''))
            dates = escape_tex(exp.get('dates', ''))
            desc = escape_tex(exp.get('description', ''))
            exp_tex += rf"\noindent \textbf{{{title}}} at \textbf{{{company}}} \hfill \textit{{{dates}}} \\" + "\n"
            if desc:
                exp_tex += r"\begin{itemize}[leftmargin=*, noitemsep, topsep=0pt]" + "\n"
                for line in desc.split('\n'):
                    if line.strip():
                        exp_tex += rf"  \item {line.strip()}" + "\n"
                exp_tex += r"\end{itemize}" + "\n\n"

    edu_tex = ""
    if data.get("education"):
        edu_tex += r"\section*{Education}" + "\n"
        for edu in data["education"]:
            degree = escape_tex(edu.get('degree', ''))
            inst = escape_tex(edu.get('institution', ''))
            year = escape_tex(edu.get('year', ''))
            edu_tex += rf"\noindent \textbf{{{degree}}}, {inst} \hfill \textit{{{year}}} \\" + "\n\n"

    skills_tex = ""
    if data.get("skills"):
        skills_tex += r"\section*{Skills}" + "\n"
        skills = escape_tex(data.get("skills", ""))
        skills_tex += rf"\noindent {skills}" + "\n"

    summary_section = r"\section*{Professional Summary}" if summary else ""
    documentclass = r"\documentclass[10pt, letterpaper]{article}"
    usepackage = r"\usepackage[margin=1in]{geometry}" + "\n" + r"\usepackage{titlesec}" + "\n" + r"\usepackage{enumitem}" + "\n" + r"\usepackage[hidelinks]{hyperref}"
    titleformat = r"\titleformat{\section}{\large\bfseries\uppercase}{}{0em}{}[\titlerule]"
    titlespacing = r"\titlespacing{\section}{0pt}{12pt}{8pt}"
    begin_doc = r"\begin{document}"
    pagestyle = r"\pagestyle{empty}"
    begin_center = r"\begin{center}"
    end_center = r"\end{center}"
    end_doc = r"\end{document}"

    latex_source = f"""{documentclass}
{usepackage}

{titleformat}
{titlespacing}

{begin_doc}
{pagestyle}

{begin_center}
    {{\huge \\textbf{{{name}}}}} \\\\ \\vspace{{2pt}}
    {contact_info}
{end_center}

{summary_section}
{summary if summary else ""}

{exp_tex}

{edu_tex}

{skills_tex}

{end_doc}
"""

    with tempfile.TemporaryDirectory() as temp_dir:
        tex_path = os.path.join(temp_dir, "resume.tex")
        with open(tex_path, "w", encoding="utf-8") as f:
            f.write(latex_source)
            
        try:
            # Run pdflatex
            result = subprocess.run(
                ["pdflatex", "-interaction=nonstopmode", "resume.tex"],
                cwd=temp_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            pdf_path = os.path.join(temp_dir, "resume.pdf")
            if not os.path.exists(pdf_path):
                # Check if it's a "not recognized" error typical on Windows
                if result.returncode != 0 and ("is not recognized" in result.stderr or "is not recognized" in result.stdout):
                    return False, "MIKTEX_MISSING"
                return False, f"LaTeX compilation failed. Output: {result.stdout}\n{result.stderr}"
                
            with open(pdf_path, "rb") as f:
                return True, f.read()
                
        except FileNotFoundError:
            return False, "MIKTEX_MISSING"
        except Exception as e:
            return False, f"LaTeX process error: {str(e)}"

def _generate_fpdf_cv(data: dict, template: str) -> tuple[bool, bytes | str]:
    try:
        from fpdf import FPDF  # Lazy Load
    except ImportError:
        return False, "Missing dependency. Please run: `pip install fpdf2`"

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
            contact_info = "  |  ".join(filter(None, [data.get('email'), data.get('phone'), data.get('linkedin')]))
            pdf.cell(0, 6, contact_info, ln=True, align="L")
            pdf.ln(8)
            
            pdf.set_text_color(0, 0, 0)

            if data.get("summary"):
                pdf.set_font("Helvetica", "B", 12)
                pdf.set_text_color(41, 128, 185)
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
                
        # --- EXECUTIVE TEMPLATE ---
        elif template == "Executive":
            pdf.set_font("Helvetica", "B", 20)
            pdf.cell(0, 10, data.get("name", ""), ln=True, align="L")
            pdf.set_line_width(0.5)
            pdf.line(15, pdf.get_y(), 195, pdf.get_y())
            pdf.ln(2)
            
            pdf.set_font("Helvetica", "", 10)
            contact_info = " | ".join(filter(None, [data.get('email'), data.get('phone'), data.get('linkedin')]))
            pdf.cell(0, 6, contact_info, ln=True, align="L")
            pdf.ln(6)

            if data.get("summary"):
                pdf.set_font("Helvetica", "B", 12)
                pdf.cell(0, 6, "PROFESSIONAL SUMMARY", ln=True)
                pdf.set_font("Helvetica", "", 11)
                pdf.multi_cell(0, 5, data.get("summary", ""))
                pdf.ln(4)

            if data.get("experience"):
                pdf.set_font("Helvetica", "B", 12)
                pdf.cell(0, 6, "PROFESSIONAL EXPERIENCE", ln=True)
                for exp in data["experience"]:
                    pdf.set_font("Helvetica", "B", 11)
                    pdf.cell(100, 6, f"{exp.get('title', '')}, {exp.get('company', '')}", ln=False)
                    pdf.set_font("Helvetica", "I", 11)
                    pdf.cell(0, 6, f"{exp.get('dates', '')}", ln=True, align="R")
                    pdf.set_font("Helvetica", "", 11)
                    desc_lines = exp.get('description', '').split('\n')
                    for line in desc_lines:
                        if line.strip():
                            pdf.multi_cell(0, 5, f"- {line.strip()}")
                    pdf.ln(3)

            if data.get("education"):
                pdf.set_font("Helvetica", "B", 12)
                pdf.cell(0, 6, "EDUCATION", ln=True)
                for edu in data["education"]:
                    pdf.set_font("Helvetica", "B", 11)
                    pdf.cell(120, 6, f"{edu.get('degree', '')}", ln=False)
                    pdf.set_font("Helvetica", "", 11)
                    pdf.cell(0, 6, f"{edu.get('year', '')}", ln=True, align="R")
                    pdf.set_font("Helvetica", "I", 11)
                    pdf.cell(0, 5, f"{edu.get('institution', '')}", ln=True)
                    pdf.ln(2)

            if data.get("skills"):
                pdf.set_font("Helvetica", "B", 12)
                pdf.cell(0, 6, "CORE COMPETENCIES", ln=True)
                pdf.set_font("Helvetica", "", 11)
                pdf.multi_cell(0, 5, data.get("skills", ""))

        pdf_bytes = pdf.output(dest='S')
        return True, bytes(pdf_bytes)
        
    except Exception as e:
        return False, f"CV Generation failed: {str(e)}"