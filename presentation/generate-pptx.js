const PptxGenJS = require("pptxgenjs");
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Color palette
// ---------------------------------------------------------------------------
const DARK_BG = "1a1a2e";
const WHITE = "FFFFFF";
const ORANGE = "FF9900"; // AWS orange
const LIGHT_GRAY = "CCCCCC";
const MID_GRAY = "888888";
const DARK_GRAY = "2d2d44";
const GREEN = "00C853";
const RED = "FF5252";
const BLUE_ACCENT = "4FC3F7";

// ---------------------------------------------------------------------------
// Reusable helpers
// ---------------------------------------------------------------------------
function addSlideNumber(slide, num) {
  slide.addText(`${num} / 25`, {
    x: 8.8,
    y: 5.3,
    w: 1.2,
    h: 0.3,
    fontSize: 9,
    color: MID_GRAY,
    align: "right",
  });
}

function titleSlideLayout(slide, title, subtitle, num) {
  slide.background = { color: DARK_BG };
  // orange accent bar top
  slide.addShape("rect", { x: 0, y: 0, w: 10, h: 0.06, fill: { color: ORANGE } });
  slide.addText(title, {
    x: 0.8,
    y: 1.4,
    w: 8.4,
    h: 1.2,
    fontSize: 36,
    bold: true,
    color: WHITE,
    align: "center",
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.8,
      y: 2.6,
      w: 8.4,
      h: 0.8,
      fontSize: 20,
      color: ORANGE,
      align: "center",
    });
  }
  addSlideNumber(slide, num);
  return slide;
}

function sectionSlideLayout(slide, title, num) {
  slide.background = { color: DARK_BG };
  slide.addShape("rect", { x: 0, y: 0, w: 10, h: 0.06, fill: { color: ORANGE } });
  slide.addText(title, {
    x: 0.8,
    y: 0.35,
    w: 8.4,
    h: 0.6,
    fontSize: 26,
    bold: true,
    color: WHITE,
  });
  // orange underline
  slide.addShape("rect", { x: 0.8, y: 0.95, w: 2.5, h: 0.04, fill: { color: ORANGE } });
  addSlideNumber(slide, num);
  return slide;
}

function codeSlideLayout(slide, title, code, lang, num) {
  sectionSlideLayout(slide, title, num);
  slide.addShape("roundRect", {
    x: 0.6,
    y: 1.3,
    w: 8.8,
    h: 3.8,
    rectRadius: 0.1,
    fill: { color: "0d0d1a" },
    line: { color: DARK_GRAY, width: 1 },
  });
  // language badge
  if (lang) {
    slide.addText(lang, {
      x: 8.0,
      y: 1.35,
      w: 1.2,
      h: 0.3,
      fontSize: 9,
      color: MID_GRAY,
      align: "right",
    });
  }
  slide.addText(code, {
    x: 0.9,
    y: 1.55,
    w: 8.2,
    h: 3.4,
    fontSize: 13,
    fontFace: "Courier New",
    color: LIGHT_GRAY,
    valign: "top",
    lineSpacingMultiple: 1.15,
    paraSpaceAfter: 2,
  });
  return slide;
}

// ---------------------------------------------------------------------------
// Build presentation
// ---------------------------------------------------------------------------
const pptx = new PptxGenJS();
pptx.author = "Yvo van Zee";
pptx.company = "Cloudar";
pptx.subject = "AWS Summit Amsterdam 2026";
pptx.title = "Shift Left Your AWS Bill";
pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 → we use 10x5.63 default

// ===================== SLIDE 1 - Title =====================
{
  const slide = pptx.addSlide();
  slide.background = { color: DARK_BG };
  slide.addShape("rect", { x: 0, y: 0, w: 10, h: 0.06, fill: { color: ORANGE } });

  slide.addText("Shift Left Your AWS Bill", {
    x: 0.8, y: 1.0, w: 8.4, h: 1.0,
    fontSize: 40, bold: true, color: WHITE, align: "center",
  });
  slide.addText("Automated CDK Cost Analysis\nin your CI/CD Pipelines", {
    x: 0.8, y: 2.1, w: 8.4, h: 0.9,
    fontSize: 22, color: ORANGE, align: "center", lineSpacingMultiple: 1.2,
  });

  // speaker info
  slide.addText("Yvo van Zee", {
    x: 0.8, y: 3.5, w: 8.4, h: 0.5,
    fontSize: 18, color: WHITE, align: "center",
  });
  slide.addText("Cloud Consultant @ Cloudar  |  AWS Community Builder (4th year)", {
    x: 0.8, y: 4.0, w: 8.4, h: 0.4,
    fontSize: 13, color: LIGHT_GRAY, align: "center",
  });
  slide.addText("AWS Summit Amsterdam 2026 - Community Lounge", {
    x: 0.8, y: 4.5, w: 8.4, h: 0.4,
    fontSize: 12, color: MID_GRAY, align: "center",
  });

  addSlideNumber(slide, 1);
  slide.addNotes(
    "Hi everyone, my name is Yvo van Zee, I'm a cloud consultant at Cloudar and I've been an AWS Community Builder for four years now. Today I want to talk about something that affects every single one of us building on AWS: the bill. More specifically, how we can catch cost surprises before they ever make it to production."
  );
}

// ===================== SLIDE 2 - The Problem =====================
{
  const slide = pptx.addSlide();
  sectionSlideLayout(slide, "The Problem", 2);

  slide.addText("Who owns the AWS bill?", {
    x: 0.8, y: 1.5, w: 8.4, h: 0.7,
    fontSize: 28, bold: true, color: ORANGE, align: "center",
  });

  // developer side
  slide.addShape("roundRect", {
    x: 1.0, y: 2.6, w: 3.4, h: 2.0, rectRadius: 0.15,
    fill: { color: DARK_GRAY },
  });
  slide.addText("\u{1F468}\u200D\u{1F4BB}", { x: 1.0, y: 2.7, w: 3.4, h: 0.8, fontSize: 36, align: "center" });
  slide.addText("Developer\nmerges PR happily", {
    x: 1.0, y: 3.4, w: 3.4, h: 1.0,
    fontSize: 13, color: GREEN, align: "center", lineSpacingMultiple: 1.2,
  });

  // arrow
  slide.addText("\u2192", {
    x: 4.4, y: 3.0, w: 1.2, h: 1.0,
    fontSize: 36, color: ORANGE, align: "center",
  });

  // finance side
  slide.addShape("roundRect", {
    x: 5.6, y: 2.6, w: 3.4, h: 2.0, rectRadius: 0.15,
    fill: { color: DARK_GRAY },
  });
  slide.addText("\u{1F4B8}", { x: 5.6, y: 2.7, w: 3.4, h: 0.8, fontSize: 36, align: "center" });
  slide.addText("Finance panics\nat the AWS bill", {
    x: 5.6, y: 3.4, w: 3.4, h: 1.0,
    fontSize: 13, color: RED, align: "center", lineSpacingMultiple: 1.2,
  });

  slide.addNotes(
    "Let me start with a question. Raise your hand if you've ever been surprised by your AWS bill. Yeah, me too. And here's the thing - in most organizations, cost awareness lives at the wrong level. Managers see dashboards, finance reviews monthly reports, but the people actually creating the resources - the developers - often have no idea what their changes cost."
  );
}

// ===================== SLIDE 3 - The ANWB Story =====================
{
  const slide = pptx.addSlide();
  sectionSlideLayout(slide, "The ANWB Story", 3);

  slide.addText("ANWB", {
    x: 0.8, y: 1.5, w: 8.4, h: 0.7,
    fontSize: 32, bold: true, color: ORANGE, align: "center",
  });
  slide.addText("The Dutch Automobile Association", {
    x: 0.8, y: 2.1, w: 8.4, h: 0.4,
    fontSize: 14, color: LIGHT_GRAY, align: "center",
  });

  // maturity arrow
  slide.addText("FinOps Maturity Journey", {
    x: 0.8, y: 3.0, w: 8.4, h: 0.5,
    fontSize: 18, bold: true, color: WHITE, align: "center",
  });

  // Reactive box
  slide.addShape("roundRect", {
    x: 1.5, y: 3.7, w: 2.5, h: 0.8, rectRadius: 0.1,
    fill: { color: DARK_GRAY }, line: { color: RED, width: 2 },
  });
  slide.addText("Reactive", {
    x: 1.5, y: 3.7, w: 2.5, h: 0.8,
    fontSize: 16, bold: true, color: RED, align: "center",
  });

  // arrow
  slide.addShape("rect", { x: 4.2, y: 4.0, w: 1.6, h: 0.06, fill: { color: ORANGE } });
  slide.addText("\u25B6", { x: 5.5, y: 3.75, w: 0.4, h: 0.5, fontSize: 18, color: ORANGE, align: "center" });

  // Proactive box
  slide.addShape("roundRect", {
    x: 6.0, y: 3.7, w: 2.5, h: 0.8, rectRadius: 0.1,
    fill: { color: DARK_GRAY }, line: { color: GREEN, width: 2 },
  });
  slide.addText("Proactive", {
    x: 6.0, y: 3.7, w: 2.5, h: 0.8,
    fontSize: 16, bold: true, color: GREEN, align: "center",
  });

  slide.addNotes(
    "Let me tell you how this project started. I was working as a cloud consultant at the ANWB - the Dutch automobile association. They had a FinOps lead named Sjak, whose mission was to bring cost awareness from the management level down to the developers. They were using Cloudability as their FinOps tool, and they'd already seen announcements about tools like Infracost that could estimate infrastructure costs before deployment."
  );
}

// ===================== SLIDE 4 - The Gap =====================
{
  const slide = pptx.addSlide();
  sectionSlideLayout(slide, "The Gap", 4);

  slide.addText("Infracost supported Terraform. We used CDK.", {
    x: 0.8, y: 1.4, w: 8.4, h: 0.6,
    fontSize: 18, italic: true, color: LIGHT_GRAY, align: "center",
  });

  // Terraform column
  slide.addShape("roundRect", {
    x: 1.0, y: 2.3, w: 3.5, h: 2.5, rectRadius: 0.15,
    fill: { color: DARK_GRAY }, line: { color: GREEN, width: 2 },
  });
  slide.addText("Terraform + Infracost", {
    x: 1.0, y: 2.5, w: 3.5, h: 0.5,
    fontSize: 16, bold: true, color: WHITE, align: "center",
  });
  slide.addText("\u2705", {
    x: 1.0, y: 3.2, w: 3.5, h: 1.0,
    fontSize: 48, align: "center",
  });

  // vs
  slide.addText("vs", {
    x: 4.5, y: 3.0, w: 1.0, h: 1.0,
    fontSize: 20, color: MID_GRAY, align: "center",
  });

  // CDK column
  slide.addShape("roundRect", {
    x: 5.5, y: 2.3, w: 3.5, h: 2.5, rectRadius: 0.15,
    fill: { color: DARK_GRAY }, line: { color: RED, width: 2 },
  });
  slide.addText("CDK / CloudFormation", {
    x: 5.5, y: 2.5, w: 3.5, h: 0.5,
    fontSize: 16, bold: true, color: WHITE, align: "center",
  });
  slide.addText("?", {
    x: 5.5, y: 3.2, w: 3.5, h: 1.0,
    fontSize: 56, bold: true, color: RED, align: "center",
  });

  slide.addNotes(
    "There was just one problem. These cost estimation tools? They worked great for Terraform. But the ANWB was all-in on AWS CDK and CloudFormation. There was no CloudFormation support at the time. So we were stuck. We had the ambition, we had the need, but we didn't have the tooling."
  );
}

// ===================== SLIDE 5 - The Idea =====================
{
  const slide = pptx.addSlide();
  sectionSlideLayout(slide, "The Idea", 5);

  slide.addText("\u{1F4A1}", {
    x: 0.8, y: 1.5, w: 8.4, h: 1.0,
    fontSize: 56, align: "center",
  });

  slide.addText('"What if we build it ourselves...\nwith AI?"', {
    x: 0.8, y: 2.6, w: 8.4, h: 1.0,
    fontSize: 26, bold: true, color: WHITE, align: "center", lineSpacingMultiple: 1.3,
  });

  slide.addShape("roundRect", {
    x: 3.5, y: 3.9, w: 3.0, h: 0.7, rectRadius: 0.1,
    fill: { color: DARK_GRAY }, line: { color: ORANGE, width: 2 },
  });
  slide.addText("Kiro by AWS", {
    x: 3.5, y: 3.9, w: 3.0, h: 0.7,
    fontSize: 18, bold: true, color: ORANGE, align: "center",
  });

  slide.addNotes(
    "That's when I suggested something a bit bold. I said: 'What if we build it ourselves? And what if we use Kiro to do it?' For those who don't know, Kiro is AWS's AI-powered coding tool. As an AWS Community Builder, I had early access to Kiro's autonomous agents. And I had a theory: with the right approach, AI could help us build a production-quality tool in weeks, not months."
  );
}

// ===================== SLIDE 6 - What is Kiro? =====================
{
  const slide = pptx.addSlide();
  sectionSlideLayout(slide, "What is Kiro?", 6);

  slide.addText("AWS's AI-powered coding tool", {
    x: 0.8, y: 1.3, w: 8.4, h: 0.5,
    fontSize: 16, color: LIGHT_GRAY, align: "center",
  });

  const pillars = [
    { label: "Spec-Driven\nDevelopment", icon: "\u{1F4DD}", desc: "Write specs,\nAI implements" },
    { label: "Autonomous\nAgents", icon: "\u{1F916}", desc: "AI picks up tasks\nand creates PRs" },
    { label: "Steering\nRules", icon: "\u{1F6E1}\uFE0F", desc: "Guidelines keep\nAI on track" },
  ];
  pillars.forEach((p, i) => {
    const x = 0.8 + i * 3.0;
    slide.addShape("roundRect", {
      x, y: 2.1, w: 2.6, h: 2.8, rectRadius: 0.15,
      fill: { color: DARK_GRAY }, line: { color: ORANGE, width: 1 },
    });
    slide.addText(p.icon, { x, y: 2.2, w: 2.6, h: 0.8, fontSize: 32, align: "center" });
    slide.addText(p.label, {
      x, y: 3.0, w: 2.6, h: 0.7,
      fontSize: 14, bold: true, color: ORANGE, align: "center", lineSpacingMultiple: 1.1,
    });
    slide.addText(p.desc, {
      x, y: 3.7, w: 2.6, h: 0.8,
      fontSize: 11, color: LIGHT_GRAY, align: "center", lineSpacingMultiple: 1.15,
    });
  });

  slide.addNotes(
    "For those unfamiliar, Kiro brings a structured approach to AI-assisted development. It's built around three concepts. First: spec-driven development - you write specifications, and the AI implements them. Second: autonomous agents - the AI can pick up tasks and create pull requests independently. And third: steering rules - guidelines that keep the AI aligned with your coding standards. Think of it as giving your AI colleague a proper onboarding."
  );
}

// ===================== SLIDE 7 - Spec-Driven Dev in Practice =====================
{
  const slide = pptx.addSlide();
  sectionSlideLayout(slide, "Spec-Driven Development in Practice", 7);

  slide.addText(".kiro/specs/", {
    x: 0.8, y: 1.3, w: 8.4, h: 0.5,
    fontSize: 16, fontFace: "Courier New", color: LIGHT_GRAY, align: "center",
  });

  const steps = [
    { label: "requirements.md", color: BLUE_ACCENT, desc: "User stories &\nacceptance criteria" },
    { label: "design.md", color: ORANGE, desc: "Architecture,\ninterfaces, data" },
    { label: "tasks.md", color: GREEN, desc: "Implementation\nsteps for AI" },
  ];
  steps.forEach((s, i) => {
    const x = 0.6 + i * 3.2;
    slide.addShape("roundRect", {
      x, y: 2.1, w: 2.8, h: 2.3, rectRadius: 0.12,
      fill: { color: DARK_GRAY }, line: { color: s.color, width: 2 },
    });
    slide.addText(s.label, {
      x, y: 2.3, w: 2.8, h: 0.5,
      fontSize: 13, fontFace: "Courier New", bold: true, color: s.color, align: "center",
    });
    slide.addText(s.desc, {
      x, y: 3.0, w: 2.8, h: 0.9,
      fontSize: 12, color: LIGHT_GRAY, align: "center", lineSpacingMultiple: 1.2,
    });

    // arrows between boxes
    if (i < 2) {
      slide.addText("\u2192", {
        x: x + 2.7, y: 2.7, w: 0.6, h: 0.6,
        fontSize: 24, color: ORANGE, align: "center",
      });
    }
  });

  slide.addText("This is the contract between you and the AI.", {
    x: 0.8, y: 4.6, w: 8.4, h: 0.4,
    fontSize: 14, italic: true, color: MID_GRAY, align: "center",
  });

  slide.addNotes(
    "Here's what spec-driven development actually looks like. For every feature, we created three documents. First, requirements - user stories with clear acceptance criteria. Then, a design document - architecture, interfaces, data models. And finally, a task list - concrete implementation steps that the AI could pick up. This isn't just documentation. This is the contract between you and the AI."
  );
}

// ===================== SLIDE 8 - From Spec to Code =====================
{
  const slide = pptx.addSlide();
  sectionSlideLayout(slide, "From Spec to Code", 8);

  // requirement box
  slide.addShape("roundRect", {
    x: 0.5, y: 1.4, w: 4.0, h: 2.6, rectRadius: 0.12,
    fill: { color: DARK_GRAY }, line: { color: BLUE_ACCENT, width: 1 },
  });
  slide.addText("Requirement", {
    x: 0.5, y: 1.5, w: 4.0, h: 0.4,
    fontSize: 11, bold: true, color: BLUE_ACCENT, align: "center",
  });
  slide.addText('"As a developer, I want to\nsee the cost impact of my\ninfrastructure changes as\na comment on my pull request."', {
    x: 0.7, y: 2.0, w: 3.6, h: 1.6,
    fontSize: 12, italic: true, color: WHITE, lineSpacingMultiple: 1.3,
  });

  // arrow
  slide.addText("\u2192", {
    x: 4.5, y: 2.2, w: 1.0, h: 1.0,
    fontSize: 36, color: ORANGE, align: "center",
  });

  // code box
  slide.addShape("roundRect", {
    x: 5.5, y: 1.4, w: 4.0, h: 2.6, rectRadius: 0.12,
    fill: { color: "0d0d1a" }, line: { color: GREEN, width: 1 },
  });
  slide.addText("Implementation", {
    x: 5.5, y: 1.5, w: 4.0, h: 0.4,
    fontSize: 11, bold: true, color: GREEN, align: "center",
  });
  slide.addText("async postCostComment(\n  prNumber: number,\n  report: CostReport\n): Promise<void> {\n  const body = formatReport(report);\n  await github.createComment({\n    issue_number: prNumber,\n    body,\n  });\n}", {
    x: 5.7, y: 1.95, w: 3.6, h: 2.0,
    fontSize: 10, fontFace: "Courier New", color: LIGHT_GRAY, lineSpacingMultiple: 1.1,
  });

  // stats bar
  slide.addShape("roundRect", {
    x: 0.8, y: 4.3, w: 8.4, h: 0.7, rectRadius: 0.1,
    fill: { color: DARK_GRAY },
  });
  slide.addText("24 correctness properties  |  Formal verification that the tool works correctly", {
    x: 0.8, y: 4.3, w: 8.4, h: 0.7,
    fontSize: 13, bold: true, color: ORANGE, align: "center",
  });

  slide.addNotes(
    "Let me show you how a spec translates to code. Here's a requirement: 'As a developer, I want to see the cost impact of my infrastructure changes as a comment on my pull request.' From this, Kiro generated the design, created the task breakdown, and then - task by task - implemented the feature. The spec defined 24 correctness properties that had to hold true. These aren't just nice-to-haves, they're the formal verification that the tool works correctly."
  );
}

// ===================== SLIDE 9 - Steering Rules =====================
{
  const slide = pptx.addSlide();
  sectionSlideLayout(slide, "Steering Rules", 9);

  slide.addText("The AI's Coding Standards", {
    x: 0.8, y: 1.3, w: 8.4, h: 0.4,
    fontSize: 16, color: LIGHT_GRAY, align: "center",
  });

  const rules = [
    "typescript-best-practices.md",
    "security-best-practices.md",
    "testing-best-practices.md",
    "error-handling.md",
    "code-review-standards.md",
    "naming-conventions.md",
    "documentation-standards.md",
    "dependency-management.md",
    "performance-guidelines.md",
    "git-workflow.md",
    "api-design.md",
    "logging-standards.md",
    "ci-cd-practices.md",
  ];
  const cols = 3;
  const colW = 2.8;
  rules.forEach((r, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = 0.6 + col * 3.2;
    const y = 1.9 + row * 0.55;
    slide.addShape("roundRect", {
      x, y, w: colW, h: 0.42, rectRadius: 0.08,
      fill: { color: DARK_GRAY },
    });
    slide.addText(r, {
      x: x + 0.1, y, w: colW - 0.2, h: 0.42,
      fontSize: 10, fontFace: "Courier New", color: i < 3 ? ORANGE : LIGHT_GRAY,
    });
  });

  slide.addText("13 steering documents = machine-readable engineering handbook", {
    x: 0.8, y: 4.7, w: 8.4, h: 0.4,
    fontSize: 13, italic: true, color: MID_GRAY, align: "center",
  });

  slide.addNotes(
    "But specs alone aren't enough. You also need guardrails. We created 13 steering documents covering everything from TypeScript best practices to security guidelines to testing standards. This is like your team's engineering handbook, but machine-readable. It ensures the AI writes code that looks like your code, follows your patterns, and meets your quality bar."
  );
}

// ===================== SLIDE 10 - Autonomous Agent Experience =====================
{
  const slide = pptx.addSlide();
  sectionSlideLayout(slide, "The Autonomous Agent Experience", 10);

  // flow boxes
  const flow = [
    { label: "GitHub Issue\ncreated", color: BLUE_ACCENT },
    { label: "Kiro picks\nit up", color: ORANGE },
    { label: "Pull Request\nappears", color: GREEN },
  ];
  flow.forEach((f, i) => {
    const x = 0.8 + i * 3.2;
    slide.addShape("roundRect", {
      x, y: 1.6, w: 2.6, h: 1.4, rectRadius: 0.12,
      fill: { color: DARK_GRAY }, line: { color: f.color, width: 2 },
    });
    slide.addText(f.label, {
      x, y: 1.6, w: 2.6, h: 1.4,
      fontSize: 16, bold: true, color: f.color, align: "center", lineSpacingMultiple: 1.2,
    });
    if (i < 2) {
      slide.addText("\u2192", {
        x: x + 2.5, y: 1.9, w: 0.8, h: 0.8,
        fontSize: 28, color: ORANGE, align: "center",
      });
    }
  });

  // anecdote box
  slide.addShape("roundRect", {
    x: 1.2, y: 3.5, w: 7.6, h: 1.3, rectRadius: 0.12,
    fill: { color: DARK_GRAY },
  });
  slide.addText(
    '"I\'d leave the office in Amsterdam, drive home to The Hague,\nand before I got home - a PR was already in my inbox."',
    {
      x: 1.4, y: 3.6, w: 7.2, h: 1.1,
      fontSize: 14, italic: true, color: WHITE, align: "center", lineSpacingMultiple: 1.4,
    }
  );

  slide.addNotes(
    "Now here's where it gets fun. Kiro's autonomous agent can pick up GitHub issues and work on them independently. I would create issues based on the spec tasks, tag them for Kiro, and the agent would start working. There were days where I'd leave the office in Amsterdam, drive home to The Hague, and before I even got home - there was already a pull request in my inbox. Ready for review."
  );
}

// ===================== SLIDE 11 - Being Honest About AI =====================
{
  const slide = pptx.addSlide();
  sectionSlideLayout(slide, "Being Honest About AI", 11);

  slide.addText("AI is a teammate, not a replacement", {
    x: 0.8, y: 1.3, w: 8.4, h: 0.5,
    fontSize: 18, italic: true, color: ORANGE, align: "center",
  });

  // What worked
  slide.addShape("roundRect", {
    x: 0.6, y: 2.1, w: 4.2, h: 2.8, rectRadius: 0.12,
    fill: { color: DARK_GRAY }, line: { color: GREEN, width: 2 },
  });
  slide.addText("What worked great", {
    x: 0.6, y: 2.2, w: 4.2, h: 0.5,
    fontSize: 14, bold: true, color: GREEN, align: "center",
  });
  const worked = [
    "Spec-to-code translation",
    "Boilerplate generation",
    "Test scaffolding",
    "Consistent coding patterns",
    "Documentation",
  ];
  worked.forEach((w, i) => {
    slide.addText(`\u2713  ${w}`, {
      x: 0.9, y: 2.75 + i * 0.38, w: 3.6, h: 0.35,
      fontSize: 12, color: LIGHT_GRAY,
    });
  });

  // Where I had to step in
  slide.addShape("roundRect", {
    x: 5.2, y: 2.1, w: 4.2, h: 2.8, rectRadius: 0.12,
    fill: { color: DARK_GRAY }, line: { color: RED, width: 2 },
  });
  slide.addText("Where I had to step in", {
    x: 5.2, y: 2.2, w: 4.2, h: 0.5,
    fontSize: 14, bold: true, color: RED, align: "center",
  });
  const stepIn = [
    "Complex business logic",
    "Edge case handling",
    "Architecture decisions",
    "Integration debugging",
    "Code review always needed",
  ];
  stepIn.forEach((s, i) => {
    slide.addText(`\u2717  ${s}`, {
      x: 5.5, y: 2.75 + i * 0.38, w: 3.6, h: 0.35,
      fontSize: 12, color: LIGHT_GRAY,
    });
  });

  slide.addNotes(
    "But let me be honest with you. The autonomous agent wasn't perfect. Despite having well-scoped issues derived from the spec-driven tasks, sometimes the output wasn't quite right. I still had to review every PR, iterate on the code, and sometimes take over entirely. This is important to understand: AI is a productivity multiplier, not a magic wand. It's a junior developer that never sleeps and never complains, but still needs code review."
  );
}

// ===================== SLIDE 12 - Results By the Numbers =====================
{
  const slide = pptx.addSlide();
  sectionSlideLayout(slide, "The Results", 12);

  const stats = [
    { num: "50", label: "Commits", sub: "in 7 weeks" },
    { num: "26", label: "AWS Resources", sub: "supported" },
    { num: "5,600", label: "Lines of Code", sub: "TypeScript" },
    { num: "2", label: "CI/CD Platforms", sub: "GitHub + GitLab" },
  ];
  stats.forEach((s, i) => {
    const x = 0.4 + i * 2.4;
    slide.addShape("roundRect", {
      x, y: 1.5, w: 2.2, h: 2.4, rectRadius: 0.12,
      fill: { color: DARK_GRAY }, line: { color: ORANGE, width: 1 },
    });
    slide.addText(s.num, {
      x, y: 1.6, w: 2.2, h: 1.2,
      fontSize: 42, bold: true, color: ORANGE, align: "center",
    });
    slide.addText(s.label, {
      x, y: 2.7, w: 2.2, h: 0.5,
      fontSize: 14, bold: true, color: WHITE, align: "center",
    });
    slide.addText(s.sub, {
      x, y: 3.15, w: 2.2, h: 0.4,
      fontSize: 11, color: LIGHT_GRAY, align: "center",
    });
  });

  // bottom banner
  slide.addShape("roundRect", {
    x: 1.5, y: 4.3, w: 7.0, h: 0.7, rectRadius: 0.1,
    fill: { color: DARK_GRAY },
  });
  slide.addText("Open source & free", {
    x: 1.5, y: 4.3, w: 7.0, h: 0.7,
    fontSize: 18, bold: true, color: GREEN, align: "center",
  });

  slide.addNotes(
    "So what did we actually build? In just seven weeks - that's 50 commits - we created a fully functional cost analysis tool. It supports 26 different AWS resource types, from EC2 and Lambda to NAT Gateways and CloudFront. It's about 5,600 lines of TypeScript. It integrates natively with both GitHub Actions and GitLab CI/CD. And it's completely open source and free to use."
  );
}

// ===================== SLIDE 13 - Architecture Diagram =====================
{
  const slide = pptx.addSlide();
  sectionSlideLayout(slide, "How It Works", 13);

  // boxes for architecture flow
  const boxes = [
    { label: "Developer\npushes code", x: 0.3, y: 1.5, w: 1.7, h: 0.9, color: BLUE_ACCENT },
    { label: "CI/CD Pipeline\ntriggered", x: 2.4, y: 1.5, w: 1.7, h: 0.9, color: ORANGE },
    { label: "CDK synth\n(base branch)", x: 4.8, y: 1.2, w: 1.8, h: 0.8, color: LIGHT_GRAY },
    { label: "CDK synth\n(PR branch)", x: 4.8, y: 2.2, w: 1.8, h: 0.8, color: LIGHT_GRAY },
    { label: "CloudFormation\nTemplates", x: 7.0, y: 1.5, w: 1.8, h: 0.9, color: WHITE },
  ];
  boxes.forEach((b) => {
    slide.addShape("roundRect", {
      x: b.x, y: b.y, w: b.w, h: b.h, rectRadius: 0.08,
      fill: { color: DARK_GRAY }, line: { color: b.color, width: 1.5 },
    });
    slide.addText(b.label, {
      x: b.x, y: b.y, w: b.w, h: b.h,
      fontSize: 10, bold: true, color: b.color, align: "center", lineSpacingMultiple: 1.1,
    });
  });

  // horizontal arrows row 1
  slide.addText("\u2192", { x: 2.0, y: 1.6, w: 0.5, h: 0.6, fontSize: 18, color: ORANGE, align: "center" });
  slide.addText("\u2192", { x: 6.6, y: 1.3, w: 0.5, h: 0.5, fontSize: 14, color: ORANGE, align: "center" });
  slide.addText("\u2192", { x: 6.6, y: 2.3, w: 0.5, h: 0.5, fontSize: 14, color: ORANGE, align: "center" });
  // fork arrows
  slide.addText("\u2197", { x: 4.1, y: 1.3, w: 0.7, h: 0.5, fontSize: 16, color: ORANGE, align: "center" });
  slide.addText("\u2198", { x: 4.1, y: 2.0, w: 0.7, h: 0.5, fontSize: 16, color: ORANGE, align: "center" });

  // second row: analyzer
  slide.addShape("roundRect", {
    x: 2.8, y: 3.3, w: 2.2, h: 1.0, rectRadius: 0.1,
    fill: { color: DARK_GRAY }, line: { color: ORANGE, width: 2 },
  });
  slide.addText("cdk-cost-analyzer\ncompares templates", {
    x: 2.8, y: 3.3, w: 2.2, h: 1.0,
    fontSize: 11, bold: true, color: ORANGE, align: "center", lineSpacingMultiple: 1.15,
  });

  // Pricing API
  slide.addShape("roundRect", {
    x: 5.5, y: 3.3, w: 1.8, h: 1.0, rectRadius: 0.1,
    fill: { color: DARK_GRAY }, line: { color: BLUE_ACCENT, width: 1.5 },
  });
  slide.addText("AWS Pricing\nAPI", {
    x: 5.5, y: 3.3, w: 1.8, h: 1.0,
    fontSize: 11, bold: true, color: BLUE_ACCENT, align: "center", lineSpacingMultiple: 1.15,
  });

  // PR comment
  slide.addShape("roundRect", {
    x: 7.8, y: 3.3, w: 1.8, h: 1.0, rectRadius: 0.1,
    fill: { color: DARK_GRAY }, line: { color: GREEN, width: 2 },
  });
  slide.addText("Cost Report\non PR/MR", {
    x: 7.8, y: 3.3, w: 1.8, h: 1.0,
    fontSize: 11, bold: true, color: GREEN, align: "center", lineSpacingMultiple: 1.15,
  });

  // arrows row 2
  slide.addText("\u2193", { x: 7.6, y: 2.5, w: 0.6, h: 0.7, fontSize: 18, color: ORANGE, align: "center" });
  slide.addText("\u2190", { x: 2.2, y: 3.5, w: 0.6, h: 0.6, fontSize: 14, color: ORANGE, align: "center" });
  slide.addText("\u2192", { x: 5.0, y: 3.5, w: 0.6, h: 0.6, fontSize: 14, color: ORANGE, align: "center" });
  slide.addText("\u2192", { x: 7.3, y: 3.5, w: 0.6, h: 0.6, fontSize: 14, color: ORANGE, align: "center" });

  slide.addNotes(
    "Let me walk you through how it works. When a developer opens a pull request, the CI/CD pipeline synthesizes the CDK app for both the base branch and the PR branch. This gives us two CloudFormation templates. The tool then diffs these templates, identifies added, removed, and modified resources, and queries the AWS Pricing API for real-time pricing data. The result? A clear cost report posted directly on your pull request."
  );
}

// ===================== SLIDE 14 - Demo Placeholder =====================
{
  const slide = pptx.addSlide();
  sectionSlideLayout(slide, "Demo", 14);

  slide.addShape("roundRect", {
    x: 1.0, y: 1.5, w: 8.0, h: 3.2, rectRadius: 0.15,
    fill: { color: "0d0d1a" }, line: { color: ORANGE, width: 2, dashType: "dash" },
  });
  slide.addText("\u25B6", {
    x: 4.0, y: 2.0, w: 2.0, h: 1.5,
    fontSize: 64, color: ORANGE, align: "center",
  });
  slide.addText("Live Demo / Pre-recorded Video", {
    x: 1.0, y: 3.4, w: 8.0, h: 0.6,
    fontSize: 16, color: LIGHT_GRAY, align: "center",
  });
  slide.addText("Developer opens PR  \u2192  GitHub Action runs  \u2192  Cost comment appears", {
    x: 1.0, y: 4.0, w: 8.0, h: 0.4,
    fontSize: 12, color: MID_GRAY, align: "center",
  });

  slide.addNotes(
    "Let me show you what this looks like in practice. Here we have a developer adding an RDS instance and a NAT Gateway to their stack. They open a pull request, and within a minute or two... there it is. A cost analysis comment showing exactly what this change will cost per month. You can see the breakdown per resource, the total delta, and even trend indicators showing if costs are going up or down."
  );
}

// ===================== SLIDE 15 - PR Comment Deep Dive =====================
{
  const slide = pptx.addSlide();
  sectionSlideLayout(slide, "The PR Comment", 15);

  // simulated PR comment
  slide.addShape("roundRect", {
    x: 0.8, y: 1.3, w: 8.4, h: 3.6, rectRadius: 0.12,
    fill: { color: "0d0d1a" }, line: { color: DARK_GRAY, width: 1 },
  });

  // header
  slide.addText("\u{1F4B0} CDK Cost Analysis Report", {
    x: 1.0, y: 1.4, w: 5.0, h: 0.4,
    fontSize: 14, bold: true, color: WHITE,
  });

  // cost impact
  slide.addText("Monthly Cost Impact:  +$245.60  \u2191", {
    x: 1.0, y: 1.9, w: 8.0, h: 0.5,
    fontSize: 18, bold: true, color: RED,
  });

  // table header
  const tableY = 2.5;
  slide.addShape("rect", { x: 1.0, y: tableY, w: 8.0, h: 0.35, fill: { color: DARK_GRAY } });
  slide.addText("Resource", { x: 1.0, y: tableY, w: 2.5, h: 0.35, fontSize: 10, bold: true, color: ORANGE });
  slide.addText("Type", { x: 3.5, y: tableY, w: 2.5, h: 0.35, fontSize: 10, bold: true, color: ORANGE });
  slide.addText("Status", { x: 6.0, y: tableY, w: 1.2, h: 0.35, fontSize: 10, bold: true, color: ORANGE });
  slide.addText("Monthly", { x: 7.2, y: tableY, w: 1.8, h: 0.35, fontSize: 10, bold: true, color: ORANGE, align: "right" });

  // table rows
  const rows = [
    { res: "MyDatabase", type: "AWS::RDS::DBInstance", status: "Added", cost: "+$180.00" },
    { res: "NatGateway1", type: "AWS::EC2::NatGateway", status: "Added", cost: "+$32.40" },
    { res: "AppBucket", type: "AWS::S3::Bucket", status: "Modified", cost: "+$33.20" },
  ];
  rows.forEach((r, i) => {
    const rowY = tableY + 0.4 + i * 0.35;
    slide.addShape("rect", { x: 1.0, y: rowY, w: 8.0, h: 0.35, fill: { color: i % 2 === 0 ? "12122a" : "0d0d1a" } });
    slide.addText(r.res, { x: 1.0, y: rowY, w: 2.5, h: 0.35, fontSize: 10, fontFace: "Courier New", color: WHITE });
    slide.addText(r.type, { x: 3.5, y: rowY, w: 2.5, h: 0.35, fontSize: 9, fontFace: "Courier New", color: LIGHT_GRAY });
    slide.addText(r.status, { x: 6.0, y: rowY, w: 1.2, h: 0.35, fontSize: 10, color: r.status === "Added" ? GREEN : ORANGE });
    slide.addText(r.cost, { x: 7.2, y: rowY, w: 1.8, h: 0.35, fontSize: 10, bold: true, color: RED, align: "right" });
  });

  // threshold bar
  const threshY = tableY + 0.4 + rows.length * 0.35 + 0.2;
  slide.addShape("roundRect", {
    x: 1.0, y: threshY, w: 8.0, h: 0.5, rectRadius: 0.08,
    fill: { color: "3a1010" }, line: { color: RED, width: 1 },
  });
  slide.addText("\u274C  Threshold exceeded: $245.60 > $200.00 (error)", {
    x: 1.2, y: threshY, w: 7.6, h: 0.5,
    fontSize: 11, bold: true, color: RED,
  });

  slide.addNotes(
    "Let's look at this comment more closely. At the top, you see the total monthly cost impact with a clear trend indicator. Then a table breaking down every resource - logical ID, type, and estimated monthly cost. And at the bottom, the threshold check. In this case, we've configured a warning at 50 dollars and an error at 200 dollars. This PR exceeds the error threshold, so the pipeline would actually fail."
  );
}

// ===================== SLIDE 16 - Cost Thresholds =====================
{
  const slide = pptx.addSlide();
  const code = `# .cdk-cost-analyzer.yml

thresholds:
  default:
    warning: 50     # Warn at $50/month
    error: 200      # Fail at $200/month

  environments:
    production:
      warning: 25   # Stricter in prod
      error: 100

    development:
      warning: 100  # More lenient in dev
      error: 500`;

  codeSlideLayout(slide, "Cost Thresholds - Your Safety Net", code, "yaml", 16);

  slide.addNotes(
    "Cost thresholds are your safety net. You configure them in a simple YAML file. You can set different thresholds per environment - maybe you're more lenient in dev but strict in production. When a PR exceeds a threshold, the pipeline fails. This doesn't block anyone - it starts a conversation. The developer sees the cost impact and can make an informed decision: is this worth it, or should we optimize?"
  );
}

// ===================== SLIDE 17 - Usage Assumptions =====================
{
  const slide = pptx.addSlide();
  const code = `# .cdk-cost-analyzer.yml

usageAssumptions:
  lambda:
    monthlyInvocations: 1000000
    avgDurationMs: 200
    memoryMB: 256

  s3:
    storageGB: 100
    monthlyGetRequests: 500000
    monthlyPutRequests: 100000

  dynamodb:
    readCapacityUnits: 25
    writeCapacityUnits: 10`;

  codeSlideLayout(slide, "Usage Assumptions - Customizable Defaults", code, "yaml", 17);

  slide.addText("Your usage patterns, your estimates", {
    x: 0.8, y: 5.2, w: 8.4, h: 0.3,
    fontSize: 12, italic: true, color: MID_GRAY, align: "center",
  });

  slide.addNotes(
    "One thing you might be wondering: how do you estimate costs for usage-based services like Lambda or S3? The tool comes with sensible defaults - for example, 1 million Lambda invocations per month, 100 GB of S3 storage. But you can customize everything in the configuration file to match your actual usage patterns. This makes the estimates much more accurate for your specific workload."
  );
}

// ===================== SLIDE 18 - Supported Resources =====================
{
  const slide = pptx.addSlide();
  sectionSlideLayout(slide, "Supported Resources", 18);

  const categories = [
    { name: "Compute", color: ORANGE, items: ["EC2", "Lambda", "ECS", "EKS"] },
    { name: "Storage", color: GREEN, items: ["S3", "EFS"] },
    { name: "Database", color: BLUE_ACCENT, items: ["RDS", "DynamoDB", "Aurora\nServerless", "ElastiCache"] },
    { name: "Networking", color: "E040FB", items: ["ALB", "NLB", "NAT GW", "VPC\nEndpoints", "CloudFront", "Transit GW"] },
    { name: "Application", color: "FFCA28", items: ["API GW", "SNS", "SQS", "Kinesis", "Step\nFunctions"] },
    { name: "Operations", color: "78909C", items: ["CloudWatch", "Secrets\nManager", "Route 53"] },
  ];

  let colIdx = 0;
  categories.forEach((cat) => {
    const catX = 0.3;
    const catY = 1.25 + colIdx * 0.65;

    slide.addText(cat.name, {
      x: catX, y: catY, w: 1.4, h: 0.5,
      fontSize: 10, bold: true, color: cat.color,
    });

    cat.items.forEach((item, j) => {
      const itemX = 1.8 + j * 1.35;
      slide.addShape("roundRect", {
        x: itemX, y: catY, w: 1.25, h: 0.5, rectRadius: 0.08,
        fill: { color: DARK_GRAY }, line: { color: cat.color, width: 1 },
      });
      slide.addText(item, {
        x: itemX, y: catY, w: 1.25, h: 0.5,
        fontSize: 9, color: WHITE, align: "center", lineSpacingMultiple: 1.0,
      });
    });
    colIdx++;
  });

  slide.addText("Each resource type is a self-contained calculator. Adding a new one = one interface.", {
    x: 0.8, y: 5.15, w: 8.4, h: 0.3,
    fontSize: 11, italic: true, color: MID_GRAY, align: "center",
  });

  slide.addNotes(
    "We currently support 26 AWS resource types across compute, storage, databases, networking, and application services. And here's the beauty of the architecture: each resource type is a self-contained calculator. Adding support for a new service means implementing a single interface. The codebase is designed for contributions."
  );
}

// ===================== SLIDE 19 - Optimization Recommendations =====================
{
  const slide = pptx.addSlide();
  sectionSlideLayout(slide, "Cost Optimization Recommendations", 19);

  slide.addText("7 built-in analyzers", {
    x: 0.8, y: 1.3, w: 8.4, h: 0.4,
    fontSize: 15, color: LIGHT_GRAY, align: "center",
  });

  const recs = [
    { icon: "\u{1F4B5}", text: "Consider Reserved Instances for RDS", save: "Save up to 40%", effort: "Low effort", risk: "Low risk" },
    { icon: "\u{1F4AA}", text: "Graviton migration for EC2 instances", save: "Save up to 20%", effort: "Medium effort", risk: "Low risk" },
    { icon: "\u{1F4E6}", text: "S3 Intelligent Tiering", save: "Save up to 30%", effort: "Low effort", risk: "No risk" },
    { icon: "\u{1F4C9}", text: "Right-size over-provisioned resources", save: "Save up to 35%", effort: "Medium effort", risk: "Medium risk" },
  ];
  recs.forEach((r, i) => {
    const y = 1.9 + i * 0.85;
    slide.addShape("roundRect", {
      x: 0.6, y, w: 8.8, h: 0.7, rectRadius: 0.1,
      fill: { color: DARK_GRAY },
    });
    slide.addText(r.icon, { x: 0.7, y, w: 0.6, h: 0.7, fontSize: 20, align: "center" });
    slide.addText(r.text, { x: 1.3, y, w: 4.0, h: 0.7, fontSize: 13, bold: true, color: WHITE });
    slide.addText(r.save, { x: 5.3, y, w: 1.6, h: 0.7, fontSize: 11, bold: true, color: GREEN, align: "center" });
    slide.addText(r.effort, { x: 6.9, y, w: 1.2, h: 0.7, fontSize: 10, color: LIGHT_GRAY, align: "center" });
    slide.addText(r.risk, { x: 8.1, y, w: 1.2, h: 0.7, fontSize: 10, color: LIGHT_GRAY, align: "center" });
  });

  slide.addText("Like having a FinOps advisor built into your CI/CD pipeline", {
    x: 0.8, y: 5.15, w: 8.4, h: 0.3,
    fontSize: 12, italic: true, color: MID_GRAY, align: "center",
  });

  slide.addNotes(
    "But we didn't stop at just showing costs. The tool also includes an optimization engine with seven different analyzers. It can suggest right-sizing, Reserved Instances, Savings Plans, Graviton migration, and more. Each recommendation comes with estimated savings, implementation effort, and risk level. It's like having a FinOps advisor built into your CI/CD pipeline."
  );
}

// ===================== SLIDE 20 - GitHub Actions =====================
{
  const slide = pptx.addSlide();
  const code = `# .github/workflows/cost-analysis.yml
name: CDK Cost Analysis

on: [pull_request]

jobs:
  cost-analysis:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: buildinginthecloud/cdk-cost-analyzer@v1
        with:
          path: './infrastructure'
          github-token: \${{ secrets.GITHUB_TOKEN }}
          aws-region: 'eu-west-1'`;

  codeSlideLayout(slide, "Getting Started - GitHub Actions", code, "yaml", 20);

  slide.addText("5 lines. That's it.", {
    x: 0.8, y: 5.2, w: 8.4, h: 0.3,
    fontSize: 14, bold: true, color: ORANGE, align: "center",
  });

  slide.addNotes(
    "Setting it up? Five lines in your GitHub Actions workflow. That's it. Point it at your CDK app directory, give it a GitHub token for posting comments, and specify your AWS region. The action handles CDK synthesis, template comparison, pricing lookup, and comment posting. Five lines to shift left your entire cost awareness."
  );
}

// ===================== SLIDE 21 - GitLab CI/CD =====================
{
  const slide = pptx.addSlide();
  const code = `# .gitlab-ci.yml
cost-analysis:
  stage: test
  image: node:20
  script:
    - npm ci
    - npx cdk synth
    - npx cdk-cost-analyzer analyze
        --base-template base.template.json
        --pr-template pr.template.json
        --gitlab-mr
        --project-id $CI_PROJECT_ID
        --mr-iid $CI_MERGE_REQUEST_IID
  only:
    - merge_requests`;

  codeSlideLayout(slide, "Getting Started - GitLab CI/CD", code, "yaml", 21);

  slide.addText("Works where you work", {
    x: 0.8, y: 5.2, w: 8.4, h: 0.3,
    fontSize: 14, bold: true, color: ORANGE, align: "center",
  });

  slide.addNotes(
    "And if you're on GitLab - like the ANWB was - it works there too. The CLI has a built-in flag to post directly to merge requests. Same tool, same analysis, different platform. Because the best FinOps tool is the one that fits your existing workflow."
  );
}

// ===================== SLIDE 22 - FinOps Pyramid =====================
{
  const slide = pptx.addSlide();
  sectionSlideLayout(slide, "The Bigger Picture - FinOps Culture", 22);

  // pyramid using shapes (3 layers, bottom to top)
  // Bottom layer - Visibility
  slide.addShape("trapezoid", {
    x: 1.5, y: 3.6, w: 7.0, h: 1.0,
    fill: { color: DARK_GRAY }, line: { color: MID_GRAY, width: 1.5 },
  });
  slide.addText("Visibility", {
    x: 1.5, y: 3.65, w: 7.0, h: 0.5,
    fontSize: 16, bold: true, color: MID_GRAY, align: "center",
  });
  slide.addText("Cost reports & dashboards", {
    x: 1.5, y: 4.1, w: 7.0, h: 0.4,
    fontSize: 11, color: MID_GRAY, align: "center",
  });

  // Middle layer - Accountability (highlighted)
  slide.addShape("trapezoid", {
    x: 2.5, y: 2.5, w: 5.0, h: 1.0,
    fill: { color: "33200a" }, line: { color: ORANGE, width: 2.5 },
  });
  slide.addText("Accountability", {
    x: 2.5, y: 2.55, w: 5.0, h: 0.5,
    fontSize: 16, bold: true, color: ORANGE, align: "center",
  });
  slide.addText("Cost in CI/CD & thresholds", {
    x: 2.5, y: 3.0, w: 5.0, h: 0.4,
    fontSize: 11, color: ORANGE, align: "center",
  });

  // Top layer - Optimization
  slide.addShape("trapezoid", {
    x: 3.5, y: 1.5, w: 3.0, h: 0.9,
    fill: { color: DARK_GRAY }, line: { color: GREEN, width: 1.5 },
  });
  slide.addText("Optimization", {
    x: 3.5, y: 1.5, w: 3.0, h: 0.5,
    fontSize: 14, bold: true, color: GREEN, align: "center",
  });
  slide.addText("Recommendations", {
    x: 3.5, y: 1.95, w: 3.0, h: 0.3,
    fontSize: 10, color: GREEN, align: "center",
  });

  // pointer
  slide.addText("\u25C0  We are here", {
    x: 7.6, y: 2.7, w: 2.0, h: 0.5,
    fontSize: 13, bold: true, color: ORANGE,
  });

  slide.addNotes(
    "Let me zoom out for a second. This tool isn't just about numbers on a PR. It's about building a FinOps culture. Traditional FinOps starts with visibility - dashboards that show what you spent last month. That's reactive. What we're doing here is shifting to accountability - making cost a first-class citizen in the development process. Every developer sees the impact of their changes, every PR has a cost conversation. And with the optimization recommendations, we're starting to climb toward the top of the pyramid."
  );
}

// ===================== SLIDE 23 - Three Takeaways =====================
{
  const slide = pptx.addSlide();
  sectionSlideLayout(slide, "What I Learned", 23);

  const takeaways = [
    {
      num: "1",
      text: "Spec-driven development makes AI 10x more effective",
      sub: "Better specs = better output. This is the contract between you and the AI.",
    },
    {
      num: "2",
      text: "Cost awareness belongs in the PR, not in a monthly report",
      sub: "By the time finance sees the bill, it's already too late.",
    },
    {
      num: "3",
      text: "Open source tools don't have to be perfect to be valuable",
      sub: "It's useful today, and it gets better with every contribution.",
    },
  ];
  takeaways.forEach((t, i) => {
    const y = 1.3 + i * 1.3;
    // number circle
    slide.addShape("ellipse", {
      x: 0.7, y: y + 0.1, w: 0.6, h: 0.6,
      fill: { color: ORANGE },
    });
    slide.addText(t.num, {
      x: 0.7, y: y + 0.1, w: 0.6, h: 0.6,
      fontSize: 18, bold: true, color: DARK_BG, align: "center",
    });
    slide.addText(t.text, {
      x: 1.5, y, w: 7.8, h: 0.5,
      fontSize: 16, bold: true, color: WHITE,
    });
    slide.addText(t.sub, {
      x: 1.5, y: y + 0.55, w: 7.8, h: 0.4,
      fontSize: 12, color: LIGHT_GRAY,
    });
  });

  slide.addNotes(
    "Three things I want you to take away from this talk. First: if you're going to use AI for development, invest in specifications. The better your specs, the better the output. Kiro with good specs was incredibly productive. Kiro without specs would have been chaos. Second: cost awareness belongs in the pull request, not in a monthly finance review. By the time finance sees the bill, it's already too late. And third: open source tools don't have to be perfect to be valuable. This tool started as a side project to solve a real problem. It's not feature-complete. But it's useful today, and it gets better with every contribution."
  );
}

// ===================== SLIDE 24 - Call to Action =====================
{
  const slide = pptx.addSlide();
  sectionSlideLayout(slide, "Get Started Today", 24);

  slide.addText("github.com/buildinginthecloud/cdk-cost-analyzer", {
    x: 0.8, y: 1.4, w: 8.4, h: 0.5,
    fontSize: 16, fontFace: "Courier New", bold: true, color: ORANGE, align: "center",
  });

  const actions = [
    { icon: "\u2B50", label: "Try it in your pipeline", desc: "5 lines of YAML to shift left your costs" },
    { icon: "\u{1F4BB}", label: "Contribute a calculator", desc: "Each resource type is a self-contained module" },
    { icon: "\u{1F4E2}", label: "Spread the word", desc: "Star the repo and share with your team" },
  ];
  actions.forEach((a, i) => {
    const y = 2.2 + i * 1.0;
    slide.addShape("roundRect", {
      x: 1.2, y, w: 7.6, h: 0.8, rectRadius: 0.1,
      fill: { color: DARK_GRAY },
    });
    slide.addText(a.icon, { x: 1.3, y, w: 0.8, h: 0.8, fontSize: 24, align: "center" });
    slide.addText(a.label, {
      x: 2.1, y, w: 3.5, h: 0.8,
      fontSize: 15, bold: true, color: WHITE,
    });
    slide.addText(a.desc, {
      x: 5.6, y, w: 3.0, h: 0.8,
      fontSize: 11, color: LIGHT_GRAY,
    });
  });

  slide.addText("It's free. It's open source. It's waiting for your PR.", {
    x: 0.8, y: 5.1, w: 8.4, h: 0.4,
    fontSize: 15, bold: true, italic: true, color: WHITE, align: "center",
  });

  slide.addNotes(
    "So here's my ask. The tool is free, it's open source, and it's on GitHub right now. Scan this QR code. If you use CDK, try it in your pipeline today - it's five lines of YAML. If you want to contribute, we'd love more resource calculators - each one is a self-contained module. And if nothing else, star the repo and share it with your team. Because the more people care about infrastructure costs at development time, the fewer surprises we all get at the end of the month."
  );
}

// ===================== SLIDE 25 - Thank You =====================
{
  const slide = pptx.addSlide();
  slide.background = { color: DARK_BG };
  slide.addShape("rect", { x: 0, y: 0, w: 10, h: 0.06, fill: { color: ORANGE } });

  slide.addText("Thank You!", {
    x: 0.8, y: 1.0, w: 8.4, h: 1.0,
    fontSize: 44, bold: true, color: WHITE, align: "center",
  });

  slide.addText("Q & A", {
    x: 0.8, y: 2.0, w: 8.4, h: 0.6,
    fontSize: 24, color: ORANGE, align: "center",
  });

  // contact info
  const contacts = [
    "Yvo van Zee",
    "Cloud Consultant @ Cloudar",
    "AWS Community Builder (4th year)",
    "",
    "github.com/buildinginthecloud/cdk-cost-analyzer",
  ];
  contacts.forEach((c, i) => {
    slide.addText(c, {
      x: 0.8, y: 3.0 + i * 0.4, w: 8.4, h: 0.35,
      fontSize: i === 0 ? 16 : i === 4 ? 13 : 12,
      bold: i === 0,
      fontFace: i === 4 ? "Courier New" : undefined,
      color: i === 0 ? WHITE : i === 4 ? ORANGE : LIGHT_GRAY,
      align: "center",
    });
  });

  addSlideNumber(slide, 25);

  slide.addNotes(
    "Thank you all for your time. I'm happy to take your questions. And if you want to chat more after - about the tool, about Kiro, about FinOps - come find me. I'll be around all day."
  );
}

// ---------------------------------------------------------------------------
// Write file
// ---------------------------------------------------------------------------
const outPath = path.join(__dirname, "shift-left-aws-bill.pptx");
pptx
  .writeFile({ fileName: outPath })
  .then(() => {
    console.log(`Presentation generated: ${outPath}`);
    console.log(`Slides: 25`);

    // verify file exists and show size
    const stats = fs.statSync(outPath);
    console.log(`File size: ${(stats.size / 1024).toFixed(1)} KB`);
  })
  .catch((err) => {
    console.error("Error generating presentation:", err);
    process.exit(1);
  });
