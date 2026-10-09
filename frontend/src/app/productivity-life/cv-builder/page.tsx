"use client";
import { Header } from "@/components/ui/Header";
import { SectionHeader } from "@/components/ui/SectionHeader";

import React, { useState, useEffect } from "react";

import { TextInput } from "@/components/ui/TextInput";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { PopupModal } from '@/components/ui/PopupModal';
import { Icon } from "@/lib/utils";

export default function CVBuilderPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [summary, setSummary] = useState("");
  
  const [experiences, setExperiences] = useState([{ title: "", company: "", dates: "", description: "" }]);
  const [educations, setEducations] = useState([{ degree: "", institution: "", year: "" }]);
  
  const [skills, setSkills] = useState("");
  const [template, setTemplate] = useState("Classic");
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        window.URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleAddExperience = () => {
    setExperiences([...experiences, { title: "", company: "", dates: "", description: "" }]);
  };

  const handleUpdateExperience = (index: number, field: string, value: string) => {
    const newExps = [...experiences];
    newExps[index] = { ...newExps[index], [field]: value };
    setExperiences(newExps);
  };

  const handleAddEducation = () => {
    setEducations([...educations, { degree: "", institution: "", year: "" }]);
  };

  const handleUpdateEducation = (index: number, field: string, value: string) => {
    const newEdus = [...educations];
    newEdus[index] = { ...newEdus[index], [field]: value };
    setEducations(newEdus);
  };

  const handleDeleteExperience = (index: number) => {
    setExperiences(experiences.filter((_, i) => i !== index));
  };

  const handleDeleteEducation = (index: number) => {
    setEducations(educations.filter((_, i) => i !== index));
  };

  const handleGeneratePDF = async (isPreview = false) => {
    if (!name.trim()) {
      setErrorMsg("Please provide at least your full name to generate a resume.");
      return;
    }
    
    setErrorMsg("");
    setLoading(true);
    
    try {
      const payload = {
        name,
        email,
        phone,
        linkedin,
        summary,
        experience: experiences.filter(e => e.title || e.company),
        education: educations.filter(e => e.degree || e.institution),
        skills,
        template: template
      };
      
      const res = await fetch("/api/files-documents/cv-builder/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to generate PDF");
      }
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      
      if (isPreview) {
        if (previewUrl) window.URL.revokeObjectURL(previewUrl);
        setPreviewUrl(url);
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = `${name.replace(/\s+/g, "_")}_Resume.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
      
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg(String(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const closePreview = () => {
    setPreviewUrl(null);
  };

  const renderBuilder = () => (
    <div className="flex flex-col gap-6 animate-slide-up w-full">
      <Header title="Resume & CV Builder" subtitle="Fill out your details to instantly generate a clean, ATS-friendly PDF resume." />
      
      <SectionHeader title="Personal Information" />
      <div className="flex flex-col gap-4 w-full">
        <div className="flex flex-col md:flex-row gap-6 w-full">
          <div className="w-full">
            <TextInput label="Full Name" placeholder="Jane Doe" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="w-full">
            <TextInput label="Email Address" placeholder="jane.doe@example.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-6 w-full">
          <div className="w-full">
            <TextInput label="Phone Number" placeholder="+1 (234) 567-8900" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <div className="w-full">
            <TextInput label="LinkedIn / Portfolio URL" placeholder="linkedin.com/in/janedoe" value={linkedin} onChange={e => setLinkedin(e.target.value)} />
          </div>
        </div>
        <div className="w-full">
          <label className="block text-sm font-medium text-[var(--theme-text)] mb-1.5">Professional Summary</label>
          <textarea 
            className="w-full bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded-lg p-3 text-[var(--theme-heading)] focus:border-[var(--theme-heading)] outline-none transition-all h-24"
            placeholder="A brief overview of your professional background, skills, and goals."
            value={summary}
            onChange={e => setSummary(e.target.value)}
          />
        </div>
      </div>

      <SectionHeader 
        title="Experience" 
        action={
          <Button 
            onClick={handleAddExperience} 
          >
            Add Role
          </Button>
        }
      />
      <div className="flex flex-col gap-4 w-full">
        {experiences.map((exp, idx) => (
          <div key={idx} className="mb-6 pb-6 border-b border-[var(--theme-ui-border)] last:border-0 last:mb-0 last:pb-0">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-[var(--theme-heading)] font-bold">Role {idx + 1}</h4>
              {experiences.length > 1 && (
                <Button 
                  onClick={() => handleDeleteExperience(idx)}
                  title="Delete Role"
                >
                  Delete Role
                </Button>
              )}
            </div>
            <div className="flex flex-col md:flex-row gap-6 w-full mb-4">
              <div className="w-full">
                <TextInput label="Job Title" placeholder="Software Engineer" value={exp.title} onChange={e => handleUpdateExperience(idx, "title", e.target.value)} />
              </div>
              <div className="w-full">
                <TextInput label="Company" placeholder="Tech Corp Inc." value={exp.company} onChange={e => handleUpdateExperience(idx, "company", e.target.value)} />
              </div>
            </div>
            <div className="w-full mb-4">
              <TextInput label="Dates" placeholder="Jan 2020 - Present" value={exp.dates} onChange={e => handleUpdateExperience(idx, "dates", e.target.value)} />
            </div>
            <div className="w-full">
              <label className="block text-sm font-medium text-[var(--theme-text)] mb-1.5">Description & Achievements</label>
              <textarea 
                className="w-full bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded-lg p-3 text-[var(--theme-heading)] focus:border-[var(--theme-heading)] outline-none transition-all h-24"
                placeholder="- Developed REST APIs...&#10;- Led a team of 3..."
                value={exp.description}
                onChange={e => handleUpdateExperience(idx, "description", e.target.value)}
              />
            </div>
          </div>
        ))}
      </div>

      <SectionHeader 
        title="Education" 
        action={
          <Button 
            onClick={handleAddEducation} 
          >
            Add Degree
          </Button>
        }
      />
      <div className="flex flex-col gap-4 w-full">
        {educations.map((edu, idx) => (
          <div key={idx} className="mb-6 pb-6 border-b border-[var(--theme-ui-border)] last:border-0 last:mb-0 last:pb-0">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-[var(--theme-heading)] font-bold">Degree {idx + 1}</h4>
              {educations.length > 1 && (
                <Button 
                  onClick={() => handleDeleteEducation(idx)}
                  title="Delete Degree"
                >
                  Delete Degree
                </Button>
              )}
            </div>
            <div className="flex flex-col md:flex-row gap-6 w-full mb-4">
              <div className="w-full">
                <TextInput label="Degree / Certificate" placeholder="B.S. Computer Science" value={edu.degree} onChange={e => handleUpdateEducation(idx, "degree", e.target.value)} />
              </div>
              <div className="w-full">
                <TextInput label="Institution" placeholder="State University" value={edu.institution} onChange={e => handleUpdateEducation(idx, "institution", e.target.value)} />
              </div>
            </div>
            <div className="w-full">
              <TextInput label="Graduation Year" placeholder="2019" value={edu.year} onChange={e => handleUpdateEducation(idx, "year", e.target.value)} />
            </div>
          </div>
        ))}
      </div>

      <SectionHeader title="Skills" />
      <div className="flex flex-col gap-4 w-full">
        <textarea 
          className="w-full bg-[var(--theme-bg)] border border-[var(--theme-ui-border)] rounded-lg p-3 text-[var(--theme-heading)] focus:border-[var(--theme-heading)] outline-none transition-all h-24"
          placeholder="Python, Project Management, Agile, SQL, Communication"
          value={skills}
          onChange={e => setSkills(e.target.value)}
        />
      </div>

      <SectionHeader title="Generation Settings" />
      <div className="flex flex-col gap-4 w-full">
        <div className="w-full md:w-80">
          <Select 
            options={[
              { label: "Classic (FPDF, Conservative)", value: "Classic" },
              { label: "Modern (FPDF, Clean)", value: "Modern" },
              { label: "Executive (FPDF, Professional)", value: "Executive" },
              { label: "LaTeX ATS (Standard LaTeX)", value: "LaTeX ATS" }
            ]} 
            value={template} 
            onChange={e => setTemplate(e.target.value)} 
          />
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-500/20 text-red-400 rounded-lg border border-red-500/30 mb-6">
          {errorMsg === "MIKTEX_MISSING" ? (
            <div className="flex flex-col gap-3">
              <p className="font-medium text-lg">LaTeX Compiler Not Found!</p>
              <p>You selected a LaTeX template, but MiKTeX is not installed on this system, or pdflatex is not in your PATH.</p>
              <a 
                href="https://miktex.org/download" 
                target="_blank" 
                rel="noreferrer"
                className="w-full h-12 text-lg relative inline-flex items-center justify-center gap-2 px-4 py-2 font-medium transition-colors duration-300 rounded-lg overflow-hidden group focus:outline-none !shadow-none !ring-0 !outline-none border-none"
                style={{ backgroundColor: "var(--theme-heading)", color: "var(--theme-bg)", boxShadow: "none" }}
              >
                Download MiKTeX
              </a>
            </div>
          ) : (
            errorMsg
          )}
        </div>
      )}

      <div className="flex gap-4 mb-10">
        <Button isLoading={loading} onClick={() => handleGeneratePDF(true)} className="flex-1">
          Live Preview
        </Button>
        <Button isLoading={loading} onClick={() => handleGeneratePDF(false)} className="flex-1">
          Download PDF
        </Button>
      </div>
    </div>
  );

  return (
    <div className="w-full h-full p-6 lg:p-10 relative z-10 overflow-y-auto animate-slide-up flex flex-col font-sans custom-scrollbar">
      {renderBuilder()}
      
      <PopupModal isOpen={!!previewUrl} onClose={closePreview} title={`Live Preview - ${template}`}>
        {previewUrl && (
          <div className="flex-1 w-full bg-[var(--theme-bg)] rounded-xl overflow-hidden min-h-[70vh]">
            <iframe 
              src={previewUrl} 
              className="w-full h-full border-none"
              title="Resume Preview"
            />
          </div>
        )}
      </PopupModal>
    </div>
  );
}
