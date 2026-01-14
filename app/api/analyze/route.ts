import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createRequire } from 'node:module';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  // Move require inside to catch initialization errors
  const require = createRequire(import.meta.url);
  
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // If API Key is missing, return mock data so the user can test the UI
    if (!apiKey || apiKey.includes('your_actual_key')) {
      console.warn("Missing OPENAI_API_KEY - Returning mock data for demonstration");
      
      const mockAnalysis = {
        score: 78,
        summary: "DEMO MODE: This is a mock analysis because no OpenAI API Key was found. Add a real key to .env.local for actual AI processing.",
        pros: ["Clean and professional layout", "Strong technical skills section", "Clear contact information"],
        cons: ["Work experience lacks quantifiable achievements", "Skills could be better categorized", "Missing a professional summary"],
        recommendations: [
          "Add specific metrics to your experience (e.g., 'Improved performance by 25%')",
          "Include a 2-3 sentence professional summary at the top",
          "Ensure all technologies mentioned are also listed in the skills section"
        ],
        jobs: [
          { title: "Frontend Developer", matchPercentage: "85%", reason: "Strong React and Tailwind CSS skills match this role." },
          { title: "Full Stack Engineer", matchPercentage: "72%", reason: "Good balance of frontend and backend knowledge." }
        ]
      };

      const { data } = await supabase
        .from('resumes')
        .insert({
          user_id: user.id,
          file_name: file.name,
          score: mockAnalysis.score,
          analysis: mockAnalysis,
        })
        .select().single();

      return NextResponse.json({ ...mockAnalysis, id: data?.id });
    }

    const openai = new OpenAI({
      apiKey: apiKey,
    });

    const fileName = file.name;
    const fileType = file.type;
    
    let text = '';
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    try {
      if (fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
        // Use the specific path to avoid the problematic debug check in pdf-parse
        // We also wrap it to prevent it from trying to read the 'test/data' directory
        const pdf = require('pdf-parse/lib/pdf-parse.js');
        const data = await pdf(buffer);
        text = data.text;
      } else if (
        fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
        fileName.toLowerCase().endsWith('.docx')
      ) {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;
      } else {
        return NextResponse.json({ error: 'Unsupported file type. Please upload PDF or DOCX.' }, { status: 400 });
      }
    } catch (parseError: any) {
      console.error('File Parsing Error:', parseError);
      return NextResponse.json({ error: `Failed to read file: ${parseError.message}` }, { status: 422 });
    }

    text = text.replace(/\s+/g, ' ').trim();

    if (!text || text.length < 50) {
      return NextResponse.json({ error: 'Resume is empty or unreadable. Please try a different file.' }, { status: 400 });
    }

    // --- FREE HEURISTIC ANALYSIS ENGINE ---
    // This runs locally and costs $0.00
    const analyzeLocally = (content: string) => {
      const lowerContent = content.toLowerCase();
      let score = 50; // Base score
      const pros = [];
      const cons = [];
      const recommendations = [];
      
      // Check for key sections
      const sections = {
        experience: ['experience', 'work history', 'employment'],
        education: ['education', 'academic', 'university', 'college'],
        skills: ['skills', 'technologies', 'technical proficiencies'],
        projects: ['projects', 'personal work', 'portfolio'],
        contact: ['email', 'phone', 'linkedin', 'github']
      };

      const foundSections = Object.entries(sections).filter(([_, keywords]) => 
        keywords.some(kw => lowerContent.includes(kw))
      ).map(([name]) => name);

      score += foundSections.length * 8;

      // Analysis Logic
      if (foundSections.includes('experience')) {
        pros.push("Professional experience section detected");
      } else {
        cons.push("Missing clear work experience section");
        recommendations.push("Add a dedicated 'Experience' section to showcase your career history.");
      }

      if (foundSections.includes('skills')) {
        pros.push("Technical skills are clearly listed");
      } else {
        cons.push("Skills section is missing or poorly defined");
        recommendations.push("Create a 'Skills' section with keywords relevant to your target roles.");
      }

      if (content.length > 1500) {
        pros.push("Comprehensive content length");
      } else if (content.length < 500) {
        score -= 15;
        cons.push("Resume is too short");
        recommendations.push("Expand on your achievements and responsibilities to provide more context.");
      }

      // Keyword-based Job Matching
      const jobMatches = [];
      if (lowerContent.includes('react') || lowerContent.includes('javascript') || lowerContent.includes('frontend')) {
        jobMatches.push({ title: "Frontend Developer", matchPercentage: "92%", reason: "Strong match for modern web technologies found in your profile." });
      }
      if (lowerContent.includes('python') || lowerContent.includes('data') || lowerContent.includes('sql')) {
        jobMatches.push({ title: "Data Analyst", matchPercentage: "88%", reason: "Your experience with data processing and databases aligns well." });
      }
      if (lowerContent.includes('manager') || lowerContent.includes('lead') || lowerContent.includes('agile')) {
        jobMatches.push({ title: "Project Manager", matchPercentage: "85%", reason: "Leadership and methodology keywords detected." });
      }
      
      // Default jobs if no keywords match
      if (jobMatches.length === 0) {
        jobMatches.push({ title: "General Associate", matchPercentage: "70%", reason: "Based on your general professional profile." });
      }

      return {
        score: Math.min(score, 99),
        summary: `Local Analysis: Your resume contains ${foundSections.length} key professional sections. ${score > 70 ? 'It is well-structured for ATS systems.' : 'It needs more optimization to pass automated filters.'}`,
        pros: pros.length > 0 ? pros : ["Basic contact information found"],
        cons: cons.length > 0 ? cons : ["No major structural issues found"],
        recommendations: recommendations.length > 0 ? recommendations : ["Quantify your achievements with numbers (e.g., 'Increased sales by 20%')"],
        jobs: jobMatches.slice(0, 3)
      };
    };

    // Use the free local analyzer
    const analysis = analyzeLocally(text);

    const { data, error: dbError } = await supabase
      .from('resumes')
      .insert({
        user_id: user.id,
        file_name: fileName,
        score: analysis.score,
        analysis: analysis,
      })
      .select()
      .single();

    return NextResponse.json({ ...analysis, id: data?.id });
  } catch (error: any) {
    console.error('Analysis API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
