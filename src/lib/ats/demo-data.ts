/**
 * ATS Demo Data Generator
 *
 * Generates realistic sample data so every section of the ATS has content
 * on first visit. All data is deterministic (seeded) for consistency.
 */

import {
  type ATSState,
  type Candidate,
  type Job,
  type Interview,
  type Offer,
  type Activity,
  type Note,
  type PipelineStage,
  DEFAULT_PIPELINE_STAGES,
  generateId,
} from "./types";

// ── Deterministic helpers ────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

function hoursFromNow(n: number): string {
  const d = new Date();
  d.setHours(d.getHours() + n);
  return d.toISOString();
}

// ── Sample data pools ────────────────────────────────────────────

const FIRST_NAMES = [
  "Sarah", "James", "Emily", "Michael", "Olivia", "Daniel", "Sophia",
  "Alexander", "Isabella", "William", "Mia", "Benjamin", "Charlotte",
  "Lucas", "Amelia", "Henry", "Harper", "Ethan", "Evelyn", "Noah",
];

const LAST_NAMES = [
  "Chen", "Johnson", "Williams", "Rodriguez", "Kim", "Patel", "Thompson",
  "Garcia", "Martinez", "Lee", "Davis", "Wilson", "Anderson", "Taylor",
  "Thomas", "Jackson", "White", "Harris", "Martin", "Brown",
];

const LOCATIONS = [
  "San Francisco, CA", "New York, NY", "Austin, TX", "Seattle, WA",
  "Boston, MA", "Chicago, IL", "Denver, CO", "Los Angeles, CA",
  "Portland, OR", "Miami, FL", "Remote",
];

const SOURCES = ["linkedin", "referral", "careers-page", "indeed", "github", "university"];

const SKILL_SETS: Record<string, string[]> = {
  frontend: ["React", "TypeScript", "Next.js", "Tailwind CSS", "GraphQL", "Jest", "Cypress"],
  backend: ["Node.js", "Python", "PostgreSQL", "Redis", "Docker", "AWS", "REST API"],
  fullstack: ["React", "Node.js", "TypeScript", "PostgreSQL", "Docker", "Git", "CI/CD"],
  design: ["Figma", "Adobe XD", "CSS", "Motion Design", "Design Systems", "Accessibility"],
  data: ["Python", "SQL", "Pandas", "TensorFlow", "Apache Spark", "Data Modeling", "Statistics"],
  devops: ["Kubernetes", "Terraform", "AWS", "CI/CD", "Docker", "Monitoring", "Linux"],
};

const DEPARTMENTS = ["Engineering", "Design", "Data Science", "DevOps", "Product", "Security"];

// ── Job generators ───────────────────────────────────────────────

interface DemoJob {
  title: string;
  department: string;
  type: "full-time" | "part-time" | "contract" | "internship";
  description: string;
  requirements: string[];
  skillPool: string;
}

const DEMO_JOBS: DemoJob[] = [
  {
    title: "Senior Frontend Engineer",
    department: "Engineering",
    type: "full-time",
    description: "Build and maintain our Next.js-based web application. Work with designers to implement pixel-perfect UI components. Optimize for performance and accessibility.",
    requirements: ["5+ years React experience", "TypeScript expertise", "Performance optimization", "Design system experience", "Testing best practices"],
    skillPool: "frontend",
  },
  {
    title: "Backend Engineer",
    department: "Engineering",
    type: "full-time",
    description: "Design and build scalable APIs and microservices. Own database schema design and optimization. Implement authentication and authorization systems.",
    requirements: ["3+ years backend development", "Node.js or Python", "SQL and NoSQL databases", "RESTful API design", "Cloud infrastructure experience"],
    skillPool: "backend",
  },
  {
    title: "Full-Stack Developer",
    department: "Engineering",
    type: "full-time",
    description: "End-to-end feature development from database to UI. Participate in architecture decisions. Mentor junior developers and review code.",
    requirements: ["4+ years full-stack experience", "React + Node.js", "Database design", "CI/CD pipeline experience", "Strong communication skills"],
    skillPool: "fullstack",
  },
  {
    title: "UX Designer",
    department: "Design",
    type: "full-time",
    description: "Create user-centered designs for our SaaS platform. Conduct user research and usability testing. Maintain and extend the design system.",
    requirements: ["3+ years UX design", "Figma proficiency", "User research methodology", "Design system experience", "Cross-functional collaboration"],
    skillPool: "design",
  },
  {
    title: "Data Scientist Intern",
    department: "Data Science",
    type: "internship",
    description: "Support the data team with analysis, model building, and visualization. Work on real production data to drive business insights.",
    requirements: ["Pursuing CS/Stats degree", "Python proficiency", "Basic ML knowledge", "SQL skills", "Curiosity and initiative"],
    skillPool: "data",
  },
];

// ── Generator ────────────────────────────────────────────────────

export function generateDemoData(): ATSState {
  const jobs: Record<string, Job> = {};
  const candidates: Record<string, Candidate> = {};
  const interviews: Record<string, Interview> = {};
  const offers: Record<string, Offer> = {};

  // --- Create jobs ---
  const jobIds: string[] = [];
  for (let i = 0; i < DEMO_JOBS.length; i++) {
    const dj = DEMO_JOBS[i];
    const id = generateId();
    jobIds.push(id);

    const status = i < 3 ? "open" : i === 3 ? "open" : "open";
    jobs[id] = {
      id,
      title: dj.title,
      department: dj.department,
      location: LOCATIONS[i % LOCATIONS.length],
      type: dj.type,
      description: dj.description,
      requirements: dj.requirements,
      status,
      pipeline: [...DEFAULT_PIPELINE_STAGES],
      candidateIds: [],
      createdAt: daysAgo(30 + i * 5),
      updatedAt: daysAgo(i * 2),
    };
  }

  // --- Create candidates (4 per job = 20 total) ---
  const stages = ["applied", "screening", "phone-screen", "interview", "final-round", "offer", "hired", "rejected"];
  let candidateIdx = 0;

  for (let ji = 0; ji < jobIds.length; ji++) {
    const jobId = jobIds[ji];
    const dj = DEMO_JOBS[ji];
    const skills = SKILL_SETS[dj.skillPool] || SKILL_SETS.fullstack;
    const candidatesPerJob = ji < 3 ? 5 : 3; // More candidates for first 3 jobs

    for (let ci = 0; ci < candidatesPerJob; ci++) {
      const id = generateId();
      const firstName = FIRST_NAMES[candidateIdx % FIRST_NAMES.length];
      const lastName = LAST_NAMES[candidateIdx % LAST_NAMES.length];
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`;

      // Distribute across pipeline stages realistically
      const stageWeights = [0, 0, 1, 2, 2, 3, 3, 4, 5, 6]; // heavier on early stages
      const stageIdx = stageWeights[candidateIdx % stageWeights.length];
      const currentStage = stages[Math.min(stageIdx, stages.length - 1)];

      // Pick 3-5 random skills as tags
      const candidateTags = skills.slice(0, 3 + (candidateIdx % 3));

      // Generate activities
      const activities: Activity[] = [
        {
          id: generateId(),
          type: "candidate-created",
          description: "Candidate added to pipeline",
          timestamp: daysAgo(20 + candidateIdx),
        },
        {
          id: generateId(),
          type: "resume-parsed",
          description: "Resume parsed and analyzed",
          timestamp: daysAgo(19 + candidateIdx),
        },
      ];

      // Add stage progression activities
      const currentIdx = stages.indexOf(currentStage);
      for (let si = 1; si <= currentIdx && si < stages.length; si++) {
        activities.push({
          id: generateId(),
          type: "stage-change",
          description: `Moved to ${stages[si]}`,
          timestamp: daysAgo(18 + candidateIdx - si * 2),
          metadata: { from: stages[si - 1], to: stages[si] },
        });
      }

      // Notes for some candidates
      const notes: Note[] = [];
      if (candidateIdx % 3 === 0) {
        notes.push({
          id: generateId(),
          content: "Strong technical background. Recommend moving forward.",
          author: "Recruiter",
          createdAt: daysAgo(15 + candidateIdx),
        });
      }

      // Resume data (structured)
      const yearsExp = 2 + (candidateIdx % 8);
      const resumeData = {
        rawText: `${firstName} ${lastName}\n${email}\n\nExperience: ${yearsExp} years in ${dj.department}\nSkills: ${candidateTags.join(", ")}`,
        structured: {
          contact: {
            name: `${firstName} ${lastName}`,
            email,
            phone: `+1-555-${String(1000 + candidateIdx).padStart(4, "0")}`,
            location: LOCATIONS[candidateIdx % LOCATIONS.length],
          },
          skills: candidateTags.map((s) => ({ name: s, category: dj.skillPool, proficiency: "intermediate" })),
          experience: [
            {
              company: ["TechCorp", "Startup Inc", "MegaSoft", "CloudBase", "DataFlow"][candidateIdx % 5],
              title: dj.title.replace("Senior ", ""),
              startDate: `${2024 - yearsExp}-01`,
              endDate: "present",
            },
          ],
          education: [
            {
              institution: ["MIT", "Stanford", "UC Berkeley", "Carnegie Mellon", "Georgia Tech"][candidateIdx % 5],
              degree: "Bachelor's",
              field: "Computer Science",
            },
          ],
        },
      };

      // Assessment result for candidates past screening
      let assessmentResult;
      if (currentIdx >= 2) {
        const score = 55 + (candidateIdx * 7) % 40; // 55-95
        assessmentResult = {
          overallScore: score,
          decision: score >= 70 ? "advance" : "review",
          criteriaName: "Default Assessment",
          axisResults: [
            { axis: "Technical Skills", score: Math.min(100, score + 5), maxScore: 100, weight: 0.3, matchedItems: candidateTags.slice(0, 2), reasoning: "Good technical match" },
            { axis: "Experience", score: Math.min(100, score - 5), maxScore: 100, weight: 0.25, matchedItems: [`${yearsExp} years`], reasoning: "Relevant experience level" },
            { axis: "Education", score: Math.min(100, score + 10), maxScore: 100, weight: 0.15, matchedItems: ["CS Degree"], reasoning: "Strong educational background" },
            { axis: "Communication", score: Math.min(100, score), maxScore: 100, weight: 0.15, matchedItems: [], reasoning: "Assessed from resume clarity" },
            { axis: "Culture Fit", score: Math.min(100, score - 2), maxScore: 100, weight: 0.15, matchedItems: [], reasoning: "Alignment with values" },
          ],
        };
      }

      candidates[id] = {
        id,
        firstName,
        lastName,
        email,
        phone: `+1-555-${String(1000 + candidateIdx).padStart(4, "0")}`,
        location: LOCATIONS[candidateIdx % LOCATIONS.length],
        currentStage,
        jobId,
        source: SOURCES[candidateIdx % SOURCES.length],
        tags: candidateTags,
        resumeData,
        assessmentResult: assessmentResult as Candidate["assessmentResult"],
        notes,
        activities,
        createdAt: daysAgo(20 + candidateIdx),
        updatedAt: daysAgo(candidateIdx % 5),
      };

      jobs[jobId].candidateIds.push(id);
      candidateIdx++;
    }
  }

  // --- Create interviews ---
  const candidateList = Object.values(candidates);
  const interviewCandidates = candidateList.filter(
    (c) => ["interview", "final-round", "phone-screen"].includes(c.currentStage)
  );

  for (let i = 0; i < interviewCandidates.length; i++) {
    const c = interviewCandidates[i];
    const id = generateId();
    const isPast = i % 3 === 0;
    const types: Interview["type"][] = ["phone", "video", "onsite", "technical", "behavioral", "panel"];

    interviews[id] = {
      id,
      candidateId: c.id,
      jobId: c.jobId,
      type: types[i % types.length],
      status: isPast ? "completed" : "scheduled",
      scheduledAt: isPast ? daysAgo(3 + i) : hoursFromNow(24 + i * 12),
      duration: [30, 45, 60][i % 3],
      interviewers: ["Alex R.", "Jordan M.", "Taylor S."].slice(0, 1 + (i % 3)),
      location: i % 2 === 0 ? "Room 3A" : undefined,
      meetingLink: i % 2 !== 0 ? "https://meet.example.com/interview" : undefined,
      notes: i % 2 === 0 ? "Focus on system design" : undefined,
      feedback: isPast
        ? {
            rating: 3 + (i % 3),
            strengths: ["Strong problem solving", "Good communication"],
            concerns: i % 2 === 0 ? ["Limited distributed systems experience"] : [],
            recommendation: i % 3 === 0 ? "hire" : "strong-hire",
            notes: "Overall positive impression",
            submittedAt: daysAgo(2 + i),
          }
        : undefined,
      createdAt: daysAgo(10 + i),
    };
  }

  // --- Create offers ---
  const offerCandidates = candidateList.filter(
    (c) => ["offer", "hired"].includes(c.currentStage)
  );

  for (let i = 0; i < offerCandidates.length; i++) {
    const c = offerCandidates[i];
    const id = generateId();
    const baseSalary = 80000 + (i * 15000);

    const status: Offer["status"] = c.currentStage === "hired"
      ? "accepted"
      : i % 3 === 0
        ? "sent"
        : "pending-approval";

    offers[id] = {
      id,
      candidateId: c.id,
      jobId: c.jobId,
      status,
      salary: {
        base: baseSalary,
        currency: "USD",
        period: "annual",
      },
      bonus: i % 2 === 0 ? baseSalary * 0.1 : undefined,
      equity: i % 2 !== 0 ? "0.05%" : undefined,
      benefits: ["Health Insurance", "401k Match", "Flexible PTO"],
      startDate: daysFromNow(30 + i * 7),
      expiresAt: daysFromNow(14 + i * 3),
      notes: i % 2 === 0 ? "Competitive package for the market" : undefined,
      approvals: [
        {
          approver: "VP Engineering",
          status: status === "pending-approval" ? "pending" : "approved",
          comment: status !== "pending-approval" ? "Looks good" : undefined,
          respondedAt: status !== "pending-approval" ? daysAgo(3) : undefined,
        },
      ],
      createdAt: daysAgo(7 + i * 2),
      updatedAt: daysAgo(i),
    };
  }

  return {
    candidates,
    jobs,
    interviews,
    offers,
    settings: {
      defaultPipeline: DEFAULT_PIPELINE_STAGES,
    },
  };
}
