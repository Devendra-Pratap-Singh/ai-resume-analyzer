export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createRequire } from 'module'
import axios from 'axios'

const require = createRequire(import.meta.url)

function generateSmartSuggestions(content: string) {
  const text = content.toLowerCase()
  const suggestions: string[] = []

  const hasNumbers = /\d+%|\d+\+|\d+ users|\d+ clients|\d+ projects|\d+ ms|\d+ sec/.test(text)
  const actionVerbs = ['built', 'developed', 'designed', 'implemented', 'optimized', 'led', 'created', 'improved', 'engineered']
  const hasActionVerbs = actionVerbs.some(verb => text.includes(verb))

  const genericPhrases = [
    'responsible for',
    'worked on',
    'helped in',
    'involved in',
    'participated in'
  ]

  const hasGeneric = genericPhrases.some(p => text.includes(p))

  const projectKeywords = ['project', 'application', 'system', 'platform', 'app']
  const hasProjects = projectKeywords.some(p => text.includes(p))

  // 1. Quantification
  if (!hasNumbers) {
    suggestions.push(
      "Add quantified achievements to your experience and projects (e.g. 'improved performance by 30%', 'served 500+ users')."
    )
  }

  // 2. Action verbs
  if (!hasActionVerbs) {
    suggestions.push(
      "Use strong action verbs like 'built', 'optimized', 'implemented', 'engineered' to start your bullet points."
    )
  }

  // 3. Generic wording
  if (hasGeneric) {
    suggestions.push(
      "Replace generic phrases like 'worked on' or 'helped in' with specific technical contributions."
    )
  }

  // 4. Project depth
  if (hasProjects && !text.includes('deployed') && !text.includes('production')) {
    suggestions.push(
      "Mention deployment details of your projects (e.g. hosted on Vercel, Render, AWS, Firebase)."
    )
  }

  // 5. Tech stack clarity
  if (!text.includes('react') && !text.includes('node') && !text.includes('python')) {
    suggestions.push(
      "Clearly list the technologies used in each project (e.g. React, Node.js, MongoDB, Python, SQL)."
    )
  }

  // 6. Leadership / collaboration
  if (!text.includes('team') && !text.includes('collaborat')) {
    suggestions.push(
      "Highlight collaboration or teamwork experience to show real-world working ability."
    )
  }

  return suggestions
}

// 2️⃣ ADD analyzeResumeAdvanced HERE
// ------------------------------
const analyzeResumeAdvanced = (content: string, aiScore: number) => {
  const lower = content.toLowerCase()

  let structureScore = 0
  let qualityScore = 0
  let penalty = 0
  let bonus = 0

  const pros: string[] = []
  const cons: string[] = []
  const recommendations: string[] = []

  // ---------------- STRUCTURE ----------------
  const hasExperience = lower.includes('experience') || lower.includes('intern')
  const hasProjects = lower.includes('projects')
  const hasSkills = lower.includes('skills')
  const hasEducation = lower.includes('education') || lower.includes('university') || lower.includes('college')

  if (hasExperience) structureScore += 18
  if (hasProjects) structureScore += 18
  if (hasSkills) structureScore += 12
  if (hasEducation) structureScore += 12

  if (!hasExperience) {
    penalty += 18
    cons.push("No experience/internship section found")
    recommendations.push("Add an Experience or Internship section even for academic, freelance, or training work.")
  } else pros.push("Experience section detected")

  if (!hasProjects) {
    penalty += 10
    cons.push("Projects section missing")
    recommendations.push("Add a Projects section to showcase hands-on work.")
  } else pros.push("Projects section present")

  // ---------------- QUALITY ----------------

  const bulletMatches = content.match(/•|-|\*/g)
  if (bulletMatches && bulletMatches.length >= 4) {
    qualityScore += 14
    pros.push("Good use of bullet points")
  } else {
    penalty += 10
    cons.push("Poor or missing bullet points")
    recommendations.push("Use bullet points to describe responsibilities and achievements.")
  }

  const metricRegex = /\d+%|\d+\+|\d+\s?(users|clients|projects|months|years|apps)/i
  if (metricRegex.test(content)) {
    qualityScore += 16
    pros.push("Quantified achievements found")
  } else {
    penalty += 12
    cons.push("Lacks quantified impact")
    recommendations.push("Add numbers (e.g. 'improved performance by 30%', 'served 500+ users').")
  }

  const actionVerbs = ['built', 'developed', 'designed', 'implemented', 'optimized', 'led', 'created']
  const verbFound = actionVerbs.some(v => lower.includes(v))
  if (verbFound) {
    qualityScore += 8
  } else {
    penalty += 6
    cons.push("Weak or missing action verbs")
    recommendations.push("Start bullet points with action verbs like built, optimized, led, designed.")
  }

  // ---------------- LENGTH ----------------
  if (content.length > 800) bonus += 6
  if (content.length < 400) {
    penalty += 8
    cons.push("Resume too short")
    recommendations.push("Expand your content with more details about projects, skills, and learning.")
  }

  // ---------------- STUDENT BOOSTER ----------------
  if (hasProjects && hasSkills && hasEducation && bulletMatches && bulletMatches.length >= 4) {
    bonus += 8
  }

  // ---------------- RAW SCORE ----------------
  let rawScore =
    structureScore +
    qualityScore +
    Math.round(aiScore * 0.35) +
    bonus -
    penalty

  // ---------------- NORMALIZATION ----------------
  // Compress top end so 95 → ~70
  rawScore = Math.round(20 + (rawScore - 20) * 0.65)

  // ---------------- BOUNDS ----------------
  if (rawScore < 20) rawScore = 20
  if (rawScore > 85) rawScore = 85

  return {
    score: rawScore,
    pros: pros.length ? pros : ["Basic structure present"],
    cons: cons.length ? cons : ["No major issues detected"],
    recommendations: recommendations.length
      ? recommendations
      : ["Improve formatting and add more quantified achievements"],
  }
}



function generateGenericProjectSuggestions(content: string) {
  const text = content.toLowerCase()
  const suggestions: string[] = []

  // Try to detect project-like patterns
  const projectIndicators = [
    'project',
    'application',
    'system',
    'platform',
    'app',
    'website',
    'dashboard',
    'portal'
  ]

  const hasProjects = projectIndicators.some(word => text.includes(word))

  if (!hasProjects) return suggestions

  // Check for metrics
  const hasNumbers = /\d+%|\d+\+|\d+ users|\d+ clients|\d+ projects|\d+ ms|\d+ sec/.test(text)

  if (!hasNumbers) {
    suggestions.push(
      "For each project, add measurable impact (e.g. 'served 500+ users', 'reduced load time by 40%', 'handled 1000+ records')."
    )
  }

  // Check for deployment
  const deploymentPlatforms = ['vercel', 'render', 'aws', 'firebase', 'netlify', 'railway', 'heroku']
  const hasDeployment = deploymentPlatforms.some(p => text.includes(p))

  if (!hasDeployment) {
    suggestions.push(
      "Mention where your projects are deployed (e.g. Vercel, AWS, Firebase) to show production readiness."
    )
  }

  // Check for tech stack clarity
  const techKeywords = ['react', 'node', 'express', 'mongodb', 'sql', 'python', 'django', 'flask', 'next', 'tailwind']
  const hasTechStack = techKeywords.some(t => text.includes(t))

  if (!hasTechStack) {
    suggestions.push(
      "Clearly specify the technology stack used in each project (e.g. React, Node.js, MongoDB, Python, SQL)."
    )
  }

  // Check for action verbs in project bullets
  const actionVerbs = ['built', 'developed', 'designed', 'implemented', 'engineered', 'optimized', 'created']
  const hasActionVerbs = actionVerbs.some(v => text.includes(v))

  if (!hasActionVerbs) {
    suggestions.push(
      "Start project bullet points with strong action verbs like 'Built', 'Designed', 'Implemented', 'Optimized'."
    )
  }

  return suggestions
}


export async function POST(req: NextRequest) {
  console.log("🔥🔥🔥 ROUTE ENTERED – VERY TOP")

  try {
    console.log("🔥 STEP 1 – Before Supabase")

    const supabase = await createClient()

    console.log("🔥 STEP 2 – After Supabase createClient")

    const { data: { user }, error } = await supabase.auth.getUser()

    console.log("🔥 STEP 3 – After getUser")
    console.log("USER:", user)
    console.log("ERROR:", error)

    console.log("🔥 STEP 4 – ENV CHECK")
    console.log("HF TOKEN:", process.env.HF_API_TOKEN)
    console.log("HF TOKEN EXISTS:", !!process.env.HF_API_TOKEN)
    console.log("HF TOKEN LENGTH:", process.env.HF_API_TOKEN?.length)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log("✅ SUPABASE USER OK:", user.email)

    console.log("HF TOKEN:", process.env.HF_API_TOKEN)
    console.log("HF TOKEN EXISTS:", !!process.env.HF_API_TOKEN)
    console.log("HF TOKEN LENGTH:", process.env.HF_API_TOKEN?.length)
    
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const fileName = file.name
    const fileType = file.type

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    let text = ''

    // ===================== FILE PARSING =====================
    try {
      // PDF
      if (fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
        const pdfParse = require('pdf-parse')
        const data = await pdfParse(buffer)

        if (!data.text || data.text.trim().length < 30) {
          throw new Error(
            'This PDF appears to be scanned (image-based). Please upload a text-based PDF or DOCX from Google Docs/Word.'
          )
        }

        text = data.text
      }

      // DOCX
      else if (
        fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        fileName.toLowerCase().endsWith('.docx')
      ) {
        const mammoth = require('mammoth')
        const result = await mammoth.extractRawText({ buffer })

        if (!result.value || result.value.trim().length < 30) {
          throw new Error('DOCX file appears to be empty or unreadable.')
        }

        text = result.value
      }

      // Unsupported
      else {
        return NextResponse.json(
          { error: 'Unsupported file type. Please upload PDF or DOCX only.' },
          { status: 400 }
        )
      }
    } catch (parseError: any) {
      console.error('File Parsing Error:', parseError)
      return NextResponse.json(
        { error: `Failed to read file: ${parseError.message}` },
        { status: 422 }
      )
    }

    text = text.replace(/\s+/g, ' ').trim()

    if (!text || text.length < 50) {
      return NextResponse.json(
        {
          error:
            'Resume content is too short or unreadable. If you uploaded a scanned PDF, please convert it to text using Google Docs or upload DOCX.',
        },
        { status: 400 }
      )
    }

    // ===================== ATS HEURISTIC ANALYSIS =====================

    const analyzeLocally = (content: string) => {
      const lowerContent = content.toLowerCase()
      let score = 50

      const pros: string[] = []
      const cons: string[] = []
      const recommendations: string[] = []

      const sections = {
        experience: ['experience', 'work history', 'employment'],
        education: ['education', 'academic', 'university', 'college'],
        skills: ['skills', 'technologies', 'technical proficiencies'],
        projects: ['projects', 'personal work', 'portfolio'],
        contact: ['email', 'phone', 'linkedin', 'github'],
      }

      const foundSections = Object.entries(sections)
        .filter(([_, keywords]) => keywords.some((kw) => lowerContent.includes(kw)))
        .map(([name]) => name)

      score += foundSections.length * 8

      if (foundSections.includes('experience')) {
        pros.push('Professional experience section detected')
      } else {
        cons.push('Missing clear work experience section')
        recommendations.push("Add a dedicated 'Experience' section to showcase your career history.")
      }

      if (foundSections.includes('skills')) {
        pros.push('Technical skills are clearly listed')
      } else {
        cons.push('Skills section is missing or poorly defined')
        recommendations.push("Create a 'Skills' section with keywords relevant to your target roles.")
      }

      if (content.length > 1500) {
        pros.push('Comprehensive content length')
      } else if (content.length < 500) {
        score -= 15
        cons.push('Resume is too short')
        recommendations.push('Expand on your achievements and responsibilities to provide more context.')
      }

      const jobMatches: any[] = []

      if (
        lowerContent.includes('react') ||
        lowerContent.includes('javascript') ||
        lowerContent.includes('frontend')
      ) {
        jobMatches.push({
          title: 'Frontend Developer',
          matchPercentage: '92%',
          reason: 'Strong match for modern web technologies found in your profile.',
        })
      }

      if (
        lowerContent.includes('python') ||
        lowerContent.includes('data') ||
        lowerContent.includes('sql')
      ) {
        jobMatches.push({
          title: 'Data Analyst',
          matchPercentage: '88%',
          reason: 'Your experience with data processing and databases aligns well.',
        })
      }

      if (
        lowerContent.includes('manager') ||
        lowerContent.includes('lead') ||
        lowerContent.includes('agile')
      ) {
        jobMatches.push({
          title: 'Project Manager',
          matchPercentage: '85%',
          reason: 'Leadership and methodology keywords detected.',
        })
      }

      if (jobMatches.length === 0) {
        jobMatches.push({
          title: 'General Associate',
          matchPercentage: '70%',
          reason: 'Based on your general professional profile.',
        })
      }

      return {
        score: Math.min(score, 99),
        pros,
        cons,
        recommendations,
        jobs: jobMatches.slice(0, 3),
      }
    }

    // ===================== HUGGINGFACE AI ANALYSIS =====================

    const analyzeWithAI = async (content: string) => {
  const idealProfile = `Strong resume with clear experience, skills, projects, education, quantified achievements and action verbs.`

  const endpoint =
    'https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2'

  const headers = {
    Authorization: `Bearer ${process.env.HF_API_TOKEN}`,
    'Content-Type': 'application/json',
  }

  const response = await axios.post(
    endpoint,
    {
      inputs: {
        source_sentence: idealProfile,
        sentences: [content],
      },
    },
    { headers, timeout: 20000 }
  )

  const similarity = response.data[0] // value between 0–1
  const score = Math.round(similarity * 100)

  return {
    score,
    strengths:
      score > 75
        ? ['Strong structure', 'Good skill relevance', 'Clear experience section']
        : ['Basic structure present'],
    weaknesses:
      score < 60
        ? ['Lacks quantified impact', 'Needs clearer experience bullets']
        : ['Minor formatting improvements needed'],
    suggestions: [
      'Add more quantified achievements',
      'Improve clarity in experience section',
      'Use strong action verbs like built, optimized, led',
    ],
  }
}




    // ===================== HYBRID ANALYSIS =====================

    const localAnalysis = analyzeLocally(text)
const aiAnalysis = await analyzeWithAI(text)

// 🔥 Advanced ATS + Quality + AI scoring
const advancedAnalysis = analyzeResumeAdvanced(text, aiAnalysis.score)

const smartSuggestions = [
  ...generateSmartSuggestions(text),
  ...generateGenericProjectSuggestions(text)
]

const analysis = {
  score: advancedAnalysis.score,
  summary: 'Advanced ATS + Quality + AI Hybrid Analysis',
  pros: advancedAnalysis.pros,
  cons: advancedAnalysis.cons,
  recommendations: [
    ...advancedAnalysis.recommendations,
    ...smartSuggestions
  ],
  jobs: localAnalysis.jobs,
}


    // ===================== DB SAVE =====================

    const { data, error: dbError } = await supabase
      .from('resumes')
      .insert({
        user_id: user.id,
        file_name: fileName,
        score: analysis.score,
        analysis: analysis,
      })
      .select()
      .single()

    if (dbError) {
      console.error('DB Insert Error:', dbError)
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    return NextResponse.json({ ...analysis, id: data?.id })
  } catch (error: any) {
    console.error('Analysis API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
