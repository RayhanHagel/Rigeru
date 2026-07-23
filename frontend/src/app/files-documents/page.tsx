import React from "react";
import Link from "next/link";
import { Folder, FileText, Table, Receipt, Sigma, FileSpreadsheet } from "lucide-react";

export default function FilesDocumentsPage() {
  const tools = [
    { href: "/files-documents/cv-builder", name: "CV Builder", icon: <FileText size={24} className="text-blue-400" />, desc: "Build and manage resumes." },
    { href: "/files-documents/pdf-studio", name: "PDF Studio", icon: <FileText size={24} className="text-red-400" />, desc: "Edit, merge, and convert PDFs." },
    { href: "/files-documents/excel-cleaner", name: "Excel Cleaner", icon: <Table size={24} className="text-emerald-400" />, desc: "Clean and format spreadsheets." },
    { href: "/files-documents/expense-tracker", name: "Expense Tracker", icon: <Receipt size={24} className="text-yellow-400" />, desc: "Extract data from receipts." },
    { href: "/files-documents/math-latex", name: "Math to LaTeX", icon: <Sigma size={24} className="text-indigo-400" />, desc: "Convert math images to LaTeX." },
    { href: "/files-documents/hash-integrity", name: "Hash Integrity", icon: <FileText size={24} className="text-purple-400" />, desc: "Verify file checksums." },
    { href: "/files-documents/link-cleaner", name: "Link Cleaner", icon: <FileSpreadsheet size={24} className="text-cyan-400" />, desc: "Clean URLs and extract domains." },
    { href: "/files-documents/file-organizer", name: "File Organizer", icon: <Folder size={24} className="text-pink-400" />, desc: "Organize files automatically." },
  ];

  return (
    <div className="w-full h-full p-6 lg:p-10 animate-fade-in relative z-10 max-w-5xl mx-auto overflow-y-auto">
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-white tracking-tight">Files & Documents</h1>
        <p className="text-zinc-400 text-sm font-medium">Tools for processing, parsing, and managing various file formats.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tools.map(tool => (
          <Link href={tool.href} key={tool.href} className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 backdrop-blur-sm flex flex-col gap-4 hover:bg-zinc-800/50 hover:border-white/20 transition-all group">
            <div className="bg-zinc-950 rounded-xl p-3 w-fit group-hover:scale-110 transition-transform">
              {tool.icon}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-1">{tool.name}</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">{tool.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
