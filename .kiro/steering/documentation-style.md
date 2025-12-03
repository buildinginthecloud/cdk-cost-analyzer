# Documentation Style Guide

## Writing Style

Write documentation with a professional, technical tone similar to AWS documentation:

- **Professional and clear** - Direct, informative language without casual expressions
- **Action-oriented** - Use active voice and imperative mood for instructions
- **Concise** - Get to the point quickly, avoid unnecessary words
- **Practical** - Focus on what users need to do, not just theory

## Tone Guidelines

### Do Use

- Clear, direct language: "Configure the IAM role" not "You might want to configure the IAM role"
- Active voice: "Deploy the stack" not "The stack should be deployed"
- Present tense: "The function returns" not "The function will return"
- Second person for instructions: "You configure" or imperative "Configure"
- Technical precision: Use exact AWS service names and terminology

### Don't Use

- Emojis or emoticons (❌ 🎉 😊)
- Exclamation marks for emphasis
- Casual expressions: "awesome", "cool", "super easy"
- Vague qualifiers: "pretty much", "basically", "kind of"
- Marketing language: "revolutionary", "game-changing", "best-in-class"
- Overused adjectives: "comprehensive" (use specific descriptions instead)

## Structure

### Headers

- Use descriptive, action-oriented headers
- "Configuring IAM Roles" not "IAM Roles Configuration"
- "What You'll Do" for overview sections
- Avoid stacked headings (heading immediately followed by another heading)

### Content Organization

- Start with overview/context
- Use tables for structured comparisons
- Use bullet lists for related items
- Use numbered lists for sequential steps
- Include code examples with proper syntax highlighting

### Examples and Code

- Provide complete, working examples
- Include comments explaining key concepts
- Use realistic placeholder values
- Show both the command and expected output when relevant

## Formatting

### Emphasis

- **Bold** for UI elements, important terms, and key concepts
- `Code formatting` for commands, file names, and technical values
- Use admonitions (warning, info, note) for important callouts

### Lists

- Use bullet points for unordered information
- Use numbered lists only for sequential steps
- Keep list items parallel in structure
- Start list items with capital letters

### Code Blocks

Always specify the language for syntax highlighting:

```yaml
# Good - with language specified
variables:
  AWS_REGION: eu-central-1
```

## Language

- **US English spelling** - "behavior" not "behaviour", "optimize" not "optimise"
- **Consistent terminology** - Use AWS service names exactly as documented
- **Avoid jargon** - Explain technical terms when first introduced
- **Active voice preferred** - "Configure the role" not "The role should be configured"

## AWS-Specific Guidelines

### Service Names

- Use official AWS service names: "AWS Secrets Manager" not "Secrets Manager"
- First mention: full name, subsequent: short name if clear from context
- Capitalize properly: "Amazon S3", "AWS Lambda", "Amazon RDS"

### Resource References

- Use exact ARN formats
- Include region and account placeholders: `<ACCOUNT>`, `<REGION>`
- Show complete resource names in examples

### Best Practices

- Reference official AWS documentation when appropriate
- Include security considerations
- Mention cost implications when relevant
- Provide troubleshooting guidance

## Examples

### Good Example

```markdown
## Configuring Secret Rotation

Enable automatic rotation for database credentials:

1. Navigate to AWS Secrets Manager console
2. Select your secret
3. Choose "Edit rotation"
4. Configure rotation schedule

**Important:** Ensure your Lambda function has network access to the database.
```

### Avoid

```markdown
## Secret Rotation 🔄

Let's set up rotation! It's super easy:

- Just go to Secrets Manager
- Click around until you find rotation settings
- Turn it on! 🎉

Pretty cool, right?
```

## Checklist

Before submitting documentation:

- [ ] Professional tone throughout
- [ ] No emojis or casual language
- [ ] Active voice used for instructions
- [ ] US English spelling
- [ ] Code blocks have language specified
- [ ] Headers are descriptive and action-oriented
- [ ] Examples are complete and realistic
- [ ] AWS service names are correct
- [ ] Security and cost considerations mentioned where relevant
