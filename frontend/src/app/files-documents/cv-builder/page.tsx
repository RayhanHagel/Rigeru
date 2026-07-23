"use client";

import React, { useState } from "react";
import { STContainer, STColumns, STTabs, STHeader, STDivider, STTitle, STMarkdown } from "@/components/streamlit";
import { TextInput } from "@/components/ui/TextInput";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";

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

  const handleGeneratePDF = async () => {
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
        template: template.includes("Classic") ? "Classic" : "Modern"
      };
      
      const res = await fetch("http://127.0.0.1:8000/api/files-documents/cv-builder/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to generate PDF");
      }
      
      // Handle file download
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name.replace(/\s+/g, "_")}_Resume.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
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

  const renderBuilder = () => (
    <div className="w-full">
      <STHeader 
        title="🪪 Resume & CV Builder" 
        subtitle="Fill out your details to instantly generate a clean, ATS-friendly PDF resume." 
      />
      
      <STContainer border className="mb-6">
        <STTitle>👤 Personal Information</STTitle>
        <STColumns>
          <TextInput label="Full Name" placeholder="Jane Doe" value={name} onChange={e => setName(e.target.value)} />
          <TextInput label="Email Address" placeholder="jane.doe@example.com" value={email} onChange={e => setEmail(e.target.value)} />
        </STColumns>
        <STColumns className="mt-4">
          <TextInput label="Phone Number" placeholder="+1 (234) 567-8900" value={phone} onChange={e => setPhone(e.target.value)} />
          <TextInput label="LinkedIn / Portfolio URL" placeholder="linkedin.com/in/janedoe" value={linkedin} onChange={e => setLinkedin(e.target.value)} />
        </STColumns>
        <div className="mt-4">
          {/* using native textarea for now, could be its own component */}
          <label className="block text-sm font-medium text-zinc-300 mb-2">Professional Summary</label>
          <textarea 
            className="w-full bg-zinc-900 border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all h-24"
            placeholder="A brief overview of your professional background, skills, and goals."
            value={summary}
            onChange={e => setSummary(e.target.value)}
          />
        </div>
      </STContainer>

      <STContainer border className="mb-6">
        <STTitle>💼 Experience</STTitle>
        {experiences.map((exp, idx) => (
          <div key={idx} className="mb-6 pb-6 border-b border-white/5 last:border-0">
            <h4 className="text-white font-medium mb-4">Role {idx + 1}</h4>
            <STColumns>
              <TextInput label="Job Title" placeholder="Software Engineer" value={exp.title} onChange={e => handleUpdateExperience(idx, "title", e.target.value)} />
              <TextInput label="Company" placeholder="Tech Corp Inc." value={exp.company} onChange={e => handleUpdateExperience(idx, "company", e.target.value)} />
            </STColumns>
            <div className="mt-4">
              <TextInput label="Dates" placeholder="Jan 2020 - Present" value={exp.dates} onChange={e => handleUpdateExperience(idx, "dates", e.target.value)} />
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-zinc-300 mb-2">Description & Achievements</label>
              <textarea 
                className="w-full bg-zinc-900 border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all h-24"
                placeholder="- Developed REST APIs...&#10;- Led a team of 3..."
                value={exp.description}
                onChange={e => handleUpdateExperience(idx, "description", e.target.value)}
              />
            </div>
          </div>
        ))}
        <Button variant="secondary" onClick={handleAddExperience}>+ Add Another Role</Button>
      </STContainer>

      <STContainer border className="mb-6">
        <STTitle>🎓 Education</STTitle>
        {educations.map((edu, idx) => (
          <div key={idx} className="mb-6 pb-6 border-b border-white/5 last:border-0">
            <h4 className="text-white font-medium mb-4">Degree {idx + 1}</h4>
            <STColumns>
              <TextInput label="Degree / Certificate" placeholder="B.S. Computer Science" value={edu.degree} onChange={e => handleUpdateEducation(idx, "degree", e.target.value)} />
              <TextInput label="Institution" placeholder="State University" value={edu.institution} onChange={e => handleUpdateEducation(idx, "institution", e.target.value)} />
            </STColumns>
            <div className="mt-4">
              <TextInput label="Graduation Year" placeholder="2019" value={edu.year} onChange={e => handleUpdateEducation(idx, "year", e.target.value)} />
            </div>
          </div>
        ))}
        <Button variant="secondary" onClick={handleAddEducation}>+ Add Another Degree</Button>
      </STContainer>

      <STContainer border className="mb-6">
        <STTitle>⭐ Skills</STTitle>
        <textarea 
          className="w-full bg-zinc-900 border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all h-24"
          placeholder="Python, Project Management, Agile, SQL, Communication"
          value={skills}
          onChange={e => setSkills(e.target.value)}
        />
      </STContainer>

      <STDivider />

      <STTitle>⚙️ Generation Settings</STTitle>
      <div className="mb-6 w-64">
        <Select 
          options={[
            { label: "Classic (Times New Roman, Conservative)", value: "Classic" },
            { label: "Modern (Arial, Clean)", value: "Modern" }
          ]} 
          value={template} 
          onChange={e => setTemplate(e.target.value)} 
        />
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-500/20 text-red-400 rounded-lg border border-red-500/30 mb-6">
          {errorMsg}
        </div>
      )}

      <Button variant="primary" isLoading={loading} onClick={handleGeneratePDF} className="w-full py-3 text-lg font-bold">
        Generate Resume PDF
      </Button>
    </div>
  );

  return (
    <div className="w-full h-full p-6 lg:p-10 animate-fade-in relative z-10 max-w-5xl mx-auto overflow-y-auto">
      {renderBuilder()}
    </div>
  );
}
