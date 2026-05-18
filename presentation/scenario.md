# Shift Left Your AWS Bill: Automated CDK Cost Analysis in your CI/CD Pipelines

## Talk Scenario & Script

**Speaker**: [Your Name] - AWS Community Builder (4th year), Cloud Consultant at Cloudar
**Event**: AWS Summit Amsterdam 2026 - Community Lounge
**Duration**: 30 minutes (20-25 min talk + 5-10 min Q&A)
**Language**: English

---

## Slide 1: Title Slide

**On screen:**
- Title: "Shift Left Your AWS Bill"
- Subtitle: "Automated CDK Cost Analysis in your CI/CD Pipelines"
- Your name, Cloudar logo, AWS Community Builder badge

**Script:**
> "Hi everyone, my name is [Name], I'm a cloud consultant at Cloudar and I've been an AWS Community Builder for four years now. Today I want to talk about something that affects every single one of us building on AWS: the bill. More specifically, how we can catch cost surprises before they ever make it to production."

---

## Slide 2: The Problem

**On screen:**
- Illustration: A developer happily merging a PR on the left, a finance person panicking at the AWS bill on the right
- Text: "Who owns the AWS bill?"

**Script:**
> "Let me start with a question. Raise your hand if you've ever been surprised by your AWS bill. Yeah, me too. And here's the thing - in most organizations, cost awareness lives at the wrong level. Managers see dashboards, finance reviews monthly reports, but the people actually creating the resources - the developers - often have no idea what their changes cost."

---

## Slide 3: The ANWB Story

**On screen:**
- ANWB logo
- Simple visual: "FinOps Maturity Journey"
- Arrow from "Reactive" to "Proactive"

**Script:**
> "Let me tell you how this project started. I was working as a cloud consultant at the ANWB - the Dutch automobile association. They had a FinOps lead named Sjak, whose mission was to bring cost awareness from the management level down to the developers. They were using Cloudability as their FinOps tool, and they'd already seen announcements about tools like Infracost that could estimate infrastructure costs before deployment."

---

## Slide 4: The Gap

**On screen:**
- Two columns:
  - Left: Terraform logo + Infracost logo + green checkmark
  - Right: CDK/CloudFormation logo + question mark
- Text: "Infracost supported Terraform. We used CDK."

**Script:**
> "There was just one problem. These cost estimation tools? They worked great for Terraform. But the ANWB was all-in on AWS CDK and CloudFormation. There was no CloudFormation support at the time. So we were stuck. We had the ambition, we had the need, but we didn't have the tooling."

---

## Slide 5: The Idea

**On screen:**
- Light bulb moment
- Kiro logo
- Text: "What if we build it ourselves... with AI?"

**Script:**
> "That's when I suggested something a bit bold. I said: 'What if we build it ourselves? And what if we use Kiro to do it?' For those who don't know, Kiro is AWS's AI-powered coding tool. As an AWS Community Builder, I had early access to Kiro's autonomous agents. And I had a theory: with the right approach, AI could help us build a production-quality tool in weeks, not months."

---

## Slide 6: What is Kiro?

**On screen:**
- Kiro logo and brief description
- Three pillars: "Spec-Driven Development" | "Autonomous Agents" | "Steering Rules"

**Script:**
> "For those unfamiliar, Kiro brings a structured approach to AI-assisted development. It's built around three concepts. First: spec-driven development - you write specifications, and the AI implements them. Second: autonomous agents - the AI can pick up tasks and create pull requests independently. And third: steering rules - guidelines that keep the AI aligned with your coding standards. Think of it as giving your AI colleague a proper onboarding."

---

## Slide 7: Spec-Driven Development in Practice

**On screen:**
- Screenshot of the `.kiro/specs/` folder structure
- Highlight the three-file pattern: `requirements.md` -> `design.md` -> `tasks.md`

**Script:**
> "Here's what spec-driven development actually looks like. For every feature, we created three documents. First, requirements - user stories with clear acceptance criteria. Then, a design document - architecture, interfaces, data models. And finally, a task list - concrete implementation steps that the AI could pick up. This isn't just documentation. This is the contract between you and the AI."

---

## Slide 8: From Spec to Code

**On screen:**
- Left side: snippet from a requirements.md (e.g., "As a developer, I want to see cost impact on my PR")
- Arrow in the middle
- Right side: snippet of the actual implementation

**Script:**
> "Let me show you how a spec translates to code. Here's a requirement: 'As a developer, I want to see the cost impact of my infrastructure changes as a comment on my pull request.' From this, Kiro generated the design, created the task breakdown, and then - task by task - implemented the feature. The spec defined 24 correctness properties that had to hold true. These aren't just nice-to-haves, they're the formal verification that the tool works correctly."

---

## Slide 9: Steering Rules - The AI's Coding Standards

**On screen:**
- Screenshot of `.kiro/steering/` folder listing
- Highlight a few: `typescript-best-practices.md`, `security-best-practices.md`, `testing-best-practices.md`

**Script:**
> "But specs alone aren't enough. You also need guardrails. We created 13 steering documents covering everything from TypeScript best practices to security guidelines to testing standards. This is like your team's engineering handbook, but machine-readable. It ensures the AI writes code that looks like your code, follows your patterns, and meets your quality bar."

---

## Slide 10: The Autonomous Agent Experience

**On screen:**
- Visual flow: GitHub Issue -> Kiro picks it up -> Pull Request appears
- Fun image: person in a car, phone notification "New PR from Kiro"

**Script:**
> "Now here's where it gets fun. Kiro's autonomous agent can pick up GitHub issues and work on them independently. I would create issues based on the spec tasks, tag them for Kiro, and the agent would start working. There were days where I'd leave the office in Amsterdam, drive home to The Hague, and before I even got home - there was already a pull request in my inbox. Ready for review."

---

## Slide 11: Being Honest About AI

**On screen:**
- Title: "AI is a teammate, not a replacement"
- Two columns: "What worked great" | "Where I had to step in"

**Script:**
> "But let me be honest with you. The autonomous agent wasn't perfect. Despite having well-scoped issues derived from the spec-driven tasks, sometimes the output wasn't quite right. I still had to review every PR, iterate on the code, and sometimes take over entirely. This is important to understand: AI is a productivity multiplier, not a magic wand. It's a junior developer that never sleeps and never complains, but still needs code review."

---

## Slide 12: The Results - By the Numbers

**On screen:**
- 50 commits in 7 weeks
- 26 AWS resource types supported
- 5,600 lines of TypeScript
- Works with GitHub Actions AND GitLab CI/CD
- Open source & free

**Script:**
> "So what did we actually build? In just seven weeks - that's 50 commits - we created a fully functional cost analysis tool. It supports 26 different AWS resource types, from EC2 and Lambda to NAT Gateways and CloudFront. It's about 5,600 lines of TypeScript. It integrates natively with both GitHub Actions and GitLab CI/CD. And it's completely open source and free to use."

---

## Slide 13: How It Works - Architecture

**On screen:**
- Architecture diagram:
  - Developer pushes code -> CI/CD pipeline triggered
  - CDK synth (base branch) -> CloudFormation template
  - CDK synth (PR branch) -> CloudFormation template
  - cdk-cost-analyzer compares both templates
  - Queries AWS Pricing API for real costs
  - Posts comment on PR/MR

**Script:**
> "Let me walk you through how it works. When a developer opens a pull request, the CI/CD pipeline synthesizes the CDK app for both the base branch and the PR branch. This gives us two CloudFormation templates. The tool then diffs these templates, identifies added, removed, and modified resources, and queries the AWS Pricing API for real-time pricing data. The result? A clear cost report posted directly on your pull request."

---

## Slide 14: Demo - The Developer Experience

**On screen:**
- Pre-recorded demo video showing:
  1. A developer opening a PR that adds an RDS instance and a NAT Gateway
  2. The GitHub Action running
  3. The cost comment appearing on the PR with the breakdown

**Script:**
> "Let me show you what this looks like in practice. Here we have a developer adding an RDS instance and a NAT Gateway to their stack. They open a pull request, and within a minute or two... there it is. A cost analysis comment showing exactly what this change will cost per month. You can see the breakdown per resource, the total delta, and even trend indicators showing if costs are going up or down."

---

## Slide 15: The PR Comment - Deep Dive

**On screen:**
- Zoomed-in screenshot of a real PR comment:
  - Monthly Cost Impact: +$245.60
  - Table with added resources, types, and costs
  - Threshold status (warning/pass/fail)

**Script:**
> "Let's look at this comment more closely. At the top, you see the total monthly cost impact with a clear trend indicator. Then a table breaking down every resource - logical ID, type, and estimated monthly cost. And at the bottom, the threshold check. In this case, we've configured a warning at 50 dollars and an error at 200 dollars. This PR exceeds the error threshold, so the pipeline would actually fail."

---

## Slide 16: Cost Thresholds - Your Safety Net

**On screen:**
- Code snippet of `.cdk-cost-analyzer.yml`:
  ```yaml
  thresholds:
    default:
      warning: 50
      error: 200
    environments:
      production:
        warning: 25
        error: 100
  ```

**Script:**
> "Cost thresholds are your safety net. You configure them in a simple YAML file. You can set different thresholds per environment - maybe you're more lenient in dev but strict in production. When a PR exceeds a threshold, the pipeline fails. This doesn't block anyone - it starts a conversation. The developer sees the cost impact and can make an informed decision: is this worth it, or should we optimize?"

---

## Slide 17: Usage Assumptions - Customizable Defaults

**On screen:**
- Configuration snippet showing usage assumptions
- Text: "Your usage patterns, your estimates"

**Script:**
> "One thing you might be wondering: how do you estimate costs for usage-based services like Lambda or S3? The tool comes with sensible defaults - for example, 1 million Lambda invocations per month, 100 GB of S3 storage. But you can customize everything in the configuration file to match your actual usage patterns. This makes the estimates much more accurate for your specific workload."

---

## Slide 18: Supported Resources

**On screen:**
- Grid of AWS service icons grouped by category:
  - Compute: EC2, Lambda, ECS, EKS
  - Storage: S3, EFS
  - Database: RDS, DynamoDB, Aurora Serverless, ElastiCache
  - Networking: ALB, NLB, NAT Gateway, VPC Endpoints, CloudFront, Transit Gateway
  - Application: API Gateway, SNS, SQS, Kinesis, Step Functions
  - Operations: CloudWatch, Secrets Manager, Route 53

**Script:**
> "We currently support 26 AWS resource types across compute, storage, databases, networking, and application services. And here's the beauty of the architecture: each resource type is a self-contained calculator. Adding support for a new service means implementing a single interface. The codebase is designed for contributions."

---

## Slide 19: Cost Optimization Recommendations

**On screen:**
- Screenshot of recommendation output:
  - "Consider Reserved Instances for RDS - save up to 40%"
  - "Graviton migration for EC2 - save up to 20%"
  - "S3 Intelligent Tiering for infrequent access patterns"

**Script:**
> "But we didn't stop at just showing costs. The tool also includes an optimization engine with seven different analyzers. It can suggest right-sizing, Reserved Instances, Savings Plans, Graviton migration, and more. Each recommendation comes with estimated savings, implementation effort, and risk level. It's like having a FinOps advisor built into your CI/CD pipeline."

---

## Slide 20: Getting Started - GitHub Actions

**On screen:**
- Clean code snippet of the GitHub Action setup:
  ```yaml
  - uses: buildinginthecloud/cdk-cost-analyzer@v1
    with:
      path: './infrastructure'
      github-token: ${{ secrets.GITHUB_TOKEN }}
      aws-region: 'eu-west-1'
  ```
- Text: "5 lines. That's it."

**Script:**
> "Setting it up? Five lines in your GitHub Actions workflow. That's it. Point it at your CDK app directory, give it a GitHub token for posting comments, and specify your AWS region. The action handles CDK synthesis, template comparison, pricing lookup, and comment posting. Five lines to shift left your entire cost awareness."

---

## Slide 21: Getting Started - GitLab CI/CD

**On screen:**
- Code snippet of GitLab CI setup
- Text: "Works where you work"

**Script:**
> "And if you're on GitLab - like the ANWB was - it works there too. The CLI has a built-in flag to post directly to merge requests. Same tool, same analysis, different platform. Because the best FinOps tool is the one that fits your existing workflow."

---

## Slide 22: The Bigger Picture - FinOps Culture

**On screen:**
- Pyramid diagram:
  - Bottom: "Visibility" (cost reports, dashboards)
  - Middle: "Accountability" (cost in CI/CD, thresholds)
  - Top: "Optimization" (recommendations, right-sizing)
- Highlight the middle layer

**Script:**
> "Let me zoom out for a second. This tool isn't just about numbers on a PR. It's about building a FinOps culture. Traditional FinOps starts with visibility - dashboards that show what you spent last month. That's reactive. What we're doing here is shifting to accountability - making cost a first-class citizen in the development process. Every developer sees the impact of their changes, every PR has a cost conversation. And with the optimization recommendations, we're starting to climb toward the top of the pyramid."

---

## Slide 23: What I Learned

**On screen:**
- Three takeaways:
  1. "Spec-driven development makes AI 10x more effective"
  2. "Cost awareness belongs in the PR, not in a monthly report"
  3. "Open source tools don't have to be perfect to be valuable"

**Script:**
> "Three things I want you to take away from this talk. First: if you're going to use AI for development, invest in specifications. The better your specs, the better the output. Kiro with good specs was incredibly productive. Kiro without specs would have been chaos. Second: cost awareness belongs in the pull request, not in a monthly finance review. By the time finance sees the bill, it's already too late. And third: open source tools don't have to be perfect to be valuable. This tool started as a side project to solve a real problem. It's not feature-complete. But it's useful today, and it gets better with every contribution."

---

## Slide 24: Call to Action

**On screen:**
- QR code linking to the GitHub repo
- GitHub repo URL: `github.com/buildinginthecloud/cdk-cost-analyzer`
- Three options:
  - Star icon: "Try it in your pipeline"
  - Code icon: "Contribute a calculator"
  - Share icon: "Spread the word"
- Text: "It's free. It's open source. It's waiting for your PR."

**Script:**
> "So here's my ask. The tool is free, it's open source, and it's on GitHub right now. Scan this QR code. If you use CDK, try it in your pipeline today - it's five lines of YAML. If you want to contribute, we'd love more resource calculators - each one is a self-contained module. And if nothing else, star the repo and share it with your team. Because the more people care about infrastructure costs at development time, the fewer surprises we all get at the end of the month."

---

## Slide 25: Thank You & Q&A

**On screen:**
- "Thank you!"
- Your contact details (LinkedIn, GitHub, etc.)
- AWS Community Builder badge
- Cloudar logo
- QR code to the repo

**Script:**
> "Thank you all for your time. I'm happy to take your questions. And if you want to chat more after - about the tool, about Kiro, about FinOps - come find me. I'll be around all day."

---

## Timing Guide

| Section | Slides | Duration |
|---------|--------|----------|
| Intro & Problem | 1-2 | 2 min |
| ANWB Story & Gap | 3-5 | 3 min |
| Kiro & Spec-Driven Dev | 6-9 | 5 min |
| Autonomous Agent & Honesty | 10-11 | 3 min |
| The Tool & Demo | 12-15 | 5 min |
| Configuration & Features | 16-19 | 4 min |
| Getting Started | 20-21 | 2 min |
| Bigger Picture & Takeaways | 22-23 | 3 min |
| Call to Action & Close | 24-25 | 1 min |
| **Q&A** | - | **5-10 min** |
| **Total** | **25 slides** | **~28-33 min** |

---

## Speaker Notes - Tips

- **Energy**: Start strong with the "raise your hand" moment. It gets the audience engaged immediately.
- **Pacing**: The ANWB story is your emotional hook. Take your time there.
- **Demo**: Keep the recorded demo short (60-90 seconds max). The audience wants to see the result, not watch a pipeline run.
- **Honesty slide**: This is your credibility moment. Don't rush it.
- **QR code**: Show it early on the call-to-action slide so people can scan while you're still talking.
- **Backup**: Have a PDF export of the slides on a USB stick. Conference projectors are unpredictable.
