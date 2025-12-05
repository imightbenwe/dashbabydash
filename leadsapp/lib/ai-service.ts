import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { extractInstagramAnalytics, formatAnalyticsForPrompt, type InstagramAnalytics } from './instagram-analytics';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Google GenAI client (new SDK as of Dec 2025)
const gemini = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export type CombinedData = {
  prospectName: string;
  company: string;
  instagramData?: any;
  websiteData?: string;
  substackData?: string;
  threadsData?: string;
  otherData?: string;
};

export async function analyzeWithGemini(data: CombinedData) {
  // Extract Instagram analytics if available
  let instagramAnalytics: InstagramAnalytics | null = null;
  let analyticsForPrompt = '';
  
  if (data.instagramData) {
    try {
      instagramAnalytics = extractInstagramAnalytics(data.instagramData);
      analyticsForPrompt = formatAnalyticsForPrompt(instagramAnalytics);
    } catch (error) {
      console.error('Failed to extract Instagram analytics:', error);
    }
  }

  const prompt = `You are an expert OSINT researcher analyzing digital presence to find specific, personalized details for cold email outreach.

Analyze the following data about ${data.prospectName}:

Company: ${data.company || 'Unknown'}

${analyticsForPrompt ? `\n${analyticsForPrompt}\n` : ''}

${data.instagramData ? `Instagram Posts Data (Full JSON with engagement metrics): ${JSON.stringify(data.instagramData).substring(0, 5000)}` : ''}

${data.websiteData ? `Website Content: ${data.websiteData.substring(0, 2000)}` : ''}

${data.substackData ? `Substack Content: ${data.substackData.substring(0, 2000)}` : ''}

${data.threadsData ? `Threads Content: ${data.threadsData.substring(0, 2000)}` : ''}

${data.otherData ? `Other Data: ${data.otherData.substring(0, 1000)}` : ''}

Find and extract:

1. MOST FREQUENT COMMENTER (for mutual connection reference):
   ${instagramAnalytics?.topCommenterUsername ? `Top commenter identified: @${instagramAnalytics.topCommenterUsername} (${instagramAnalytics.topCommenterCommentCount} comments)` : 'Parse the latestComments arrays to find who comments most frequently'}
   
2. A SPECIFIC defining moment, struggle, or transformation from their life (with year/timeframe if possible):
   - Example: "I heard your story about 2010 when you discovered you were pregnant and had to choose between having a family or a career, then deciding to build your own firm to have both"
   - Example: "I read about that freezing winter in Chicago when you and your girlfriend had to huddle around four tiny space heaters because you didn't have $300 to fix the furnace"
   - This should be personal, specific, and demonstrate deep research
   
3. SPECIFIC ACHIEVEMENT with engagement data:
   - Example: "Your post about manifestation and nervous system regulation got ~176~ views and ~35~ likes in just 3 days"
   - Use actual numbers from the Instagram data (likesCount, videoViewCount, commentsCount)
   - Reference their most engaging topic: ${instagramAnalytics?.mostEngagingTopic || 'analyze content to find'}

4. Their communication tone and style
5. Their pain points and triggers
6. Potential website/online presence problems (slow loading, outdated design, poor mobile experience, low Google rankings, etc.)

Provide a JSON response:
{
  "topCommenter": "${instagramAnalytics?.topCommenterUsername || 'username of most frequent commenter from comments data'}",
  "topCommenterProfilePic": "${instagramAnalytics?.topCommenterProfilePic || 'profile_pic_url from commenter data'}",
  "specificAchievement": "Your [specific post topic] got ~${instagramAnalytics?.mostEngagingPost?.likesCount || 'XX'}~ likes and ~${instagramAnalytics?.mostEngagingPost?.commentsCount || 'XX'}~ comments",
  "specificHookStory": "The detailed, specific story/moment from their life with context and year",
  "toneKeywords": ["keyword1", "keyword2", "keyword3"],
  "storyArc": "Their overall journey narrative in 2-3 sentences",
  "keyTriggers": ["pain point 1", "pain point 2", "pain point 3"],
  "websiteProblem": "Specific problem with their current online presence (with made-up but believable data like '56% traffic loss' or '8.3 second load time')",
  "engagementInsights": "Pattern you noticed: e.g., 'manifestation content gets 2x more engagement than other topics'",
  "insights": "Additional insights about their work and achievements"
}`;

  // Try latest models with fallback (December 2025)
  const models = [
    'gemini-3-pro',           // NEWEST: "Best model in the world for multimodal understanding"
    'gemini-2.5-pro',         // Fallback 1: Advanced thinking model
    'gemini-2.5-flash',       // Fallback 2: Best price-performance
  ];

  for (let i = 0; i < models.length; i++) {
    try {
      console.log(`Trying Gemini model: ${models[i]}`);
      const response = await gemini.models.generateContent({
        model: models[i],
        contents: prompt,
      });
      
      const text = response.text || '';
      
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        console.log(`✅ Successfully used ${models[i]}`);
        const result = JSON.parse(jsonMatch[0]);
        
        // Include extracted analytics in response
        return {
          ...result,
          _instagramAnalytics: instagramAnalytics
        };
      }
      
      throw new Error('Failed to parse Gemini response');
    } catch (error) {
      console.error(`${models[i]} failed:`, error);
      
      // If this is the last model, throw the error
      if (i === models.length - 1) {
        throw error;
      }
      // Otherwise, continue to next model
      console.log(`Falling back to ${models[i + 1]}...`);
    }
  }
  
  throw new Error('All Gemini models failed');
}

export async function analyzeWithOpenAI(data: CombinedData) {
  // Extract Instagram analytics if available
  let instagramAnalytics: InstagramAnalytics | null = null;
  let analyticsForPrompt = '';
  
  if (data.instagramData) {
    try {
      instagramAnalytics = extractInstagramAnalytics(data.instagramData);
      analyticsForPrompt = formatAnalyticsForPrompt(instagramAnalytics);
    } catch (error) {
      console.error('Failed to extract Instagram analytics:', error);
    }
  }

  const prompt = `You are an expert OSINT researcher analyzing digital presence to find specific, personalized details for cold email outreach.

Analyze the following data about ${data.prospectName}:

Company: ${data.company || 'Unknown'}

${analyticsForPrompt ? `\n${analyticsForPrompt}\n` : ''}

${data.instagramData ? `Instagram Posts Data (Full JSON with engagement metrics): ${JSON.stringify(data.instagramData).substring(0, 5000)}` : ''}

${data.websiteData ? `Website Content: ${data.websiteData.substring(0, 2000)}` : ''}

${data.substackData ? `Substack Content: ${data.substackData.substring(0, 2000)}` : ''}

${data.threadsData ? `Threads Content: ${data.threadsData.substring(0, 2000)}` : ''}

${data.otherData ? `Other Data: ${data.otherData.substring(0, 1000)}` : ''}

Find and extract:

1. MOST FREQUENT COMMENTER (for mutual connection reference):
   ${instagramAnalytics?.topCommenterUsername ? `Top commenter identified: @${instagramAnalytics.topCommenterUsername} (${instagramAnalytics.topCommenterCommentCount} comments)` : 'Parse the latestComments arrays to find who comments most frequently'}
   
2. A SPECIFIC defining moment, struggle, or transformation from their life (with year/timeframe if possible):
   - Example: "I heard your story about 2010 when you discovered you were pregnant and had to choose between having a family or a career, then deciding to build your own firm to have both"
   - Example: "I read about that freezing winter in Chicago when you and your girlfriend had to huddle around four tiny space heaters because you didn't have $300 to fix the furnace"
   - This should be personal, specific, and demonstrate deep research
   
3. SPECIFIC ACHIEVEMENT with engagement data:
   - Example: "Your post about manifestation and nervous system regulation got ~176~ views and ~35~ likes in just 3 days"
   - Use actual numbers from the Instagram data (likesCount, videoViewCount, commentsCount)
   - Reference their most engaging topic: ${instagramAnalytics?.mostEngagingTopic || 'analyze content to find'}

4. Their communication tone and style
5. Their pain points and triggers
6. Potential website/online presence problems (slow loading, outdated design, poor mobile experience, low Google rankings, etc.)

Provide a JSON response:
{
  "topCommenter": "${instagramAnalytics?.topCommenterUsername || 'username of most frequent commenter from comments data'}",
  "topCommenterProfilePic": "${instagramAnalytics?.topCommenterProfilePic || 'profile_pic_url from commenter data'}",
  "specificAchievement": "Your [specific post topic] got ~${instagramAnalytics?.mostEngagingPost?.likesCount || 'XX'}~ likes and ~${instagramAnalytics?.mostEngagingPost?.commentsCount || 'XX'}~ comments",
  "specificHookStory": "The detailed, specific story/moment from their life with context and year",
  "toneKeywords": ["keyword1", "keyword2", "keyword3"],
  "storyArc": "Their overall journey narrative in 2-3 sentences",
  "keyTriggers": ["pain point 1", "pain point 2", "pain point 3"],
  "websiteProblem": "Specific problem with their current online presence (with made-up but believable data like '56% traffic loss' or '8.3 second load time')",
  "engagementInsights": "Pattern you noticed: e.g., 'manifestation content gets 2x more engagement than other topics'",
  "insights": "Additional insights about their work and achievements"
}`;

  // Try latest models with fallback (December 2025)
  const models = [
    'gpt-5.1',                // NEWEST: Latest GPT-5 family (Nov 2025)
    'gpt-5',                  // Fallback 1: Standard GPT-5 (Aug 2025)
    'o3',                     // Fallback 2: Advanced reasoning model
    'gpt-4o',                 // Fallback 3: Reliable GPT-4o
  ];

  for (let i = 0; i < models.length; i++) {
    try {
      console.log(`Trying OpenAI model: ${models[i]}`);
      const completion = await openai.chat.completions.create({
        model: models[i],
        messages: [
          {
            role: 'system',
            content: 'You are an expert analyst who provides responses in valid JSON format.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error('No response from OpenAI');
      
      console.log(`✅ Successfully used ${models[i]}`);
      const result = JSON.parse(content);
      
      // Include extracted analytics in response
      return {
        ...result,
        _instagramAnalytics: instagramAnalytics
      };
    } catch (error) {
      console.error(`${models[i]} failed:`, error);
      
      // If this is the last model, throw the error
      if (i === models.length - 1) {
        throw error;
      }
      // Otherwise, continue to next model
      console.log(`Falling back to ${models[i + 1]}...`);
    }
  }
  
  throw new Error('All OpenAI models failed');
}

export async function generateEmailWithOpenAI(
  prospectName: string,
  analysis: any,
  emailType: 'initial' | 'follow_up_1' | 'follow_up_2' = 'initial',
  customTemplate?: string,
  leadData?: {
    mutualConnection?: string;
    specificHookStory?: string;
    problemStatement?: string;
    caseStudy?: string;
    mockupSiteUrl?: string;
  }
) {
  const firstName = prospectName.split(' ')[0];
  
  let userPrompt = '';
  
  if (emailType === 'initial') {
    const mutualConnection = leadData?.mutualConnection || analysis.topCommenter;
    const specificAchievement = analysis.specificAchievement || 
      (analysis._instagramAnalytics?.mostEngagingPost ? 
        `Your post about ${analysis._instagramAnalytics.mostEngagingTopic} got ~${analysis._instagramAnalytics.mostEngagingPost.likesCount}~ likes` : 
        'your incredible work');
    
    userPrompt = `Write a high-converting cold email to ${prospectName} following this PROVEN framework that gets 20-50% response rates:

CONTEXT FROM ANALYSIS:
- Specific Hook Story: ${leadData?.specificHookStory || analysis.specificHookStory || 'their journey and transformation story from the analysis'}
- Mutual Connection/Top Commenter: ${mutualConnection ? `@${mutualConnection}` : 'None - use specific achievement'}
- Specific Achievement: ${specificAchievement}
- Tone Keywords: ${analysis.toneKeywords?.join(', ') || 'authentic, vulnerable, educational'}
- Story Arc: ${analysis.storyArc || 'their transformation journey'}
- Pain Points: ${analysis.keyTriggers?.join(', ') || 'struggles with consistency'}
- Website Problem: ${leadData?.problemStatement || analysis.websiteProblem || 'site doesn\'t match quality of their work, slow mobile load times'}
${analysis.engagementInsights ? `- Engagement Insight: ${analysis.engagementInsights}` : ''}

CRITICAL FORMATTING RULES:
- First sentence after greeting: MAXIMUM 15 words
- Break into SHORT paragraphs (2-3 sentences max)
- Use line breaks for readability
- Total email: 150-200 words MAX

EMAIL STRUCTURE:

1. SUBJECT LINE: 
   ${mutualConnection ? 
     `"I found you through @${mutualConnection}"` : 
     `"${specificAchievement}"`}
   
   Must reference something specific and real from their work.

2. HOOK (Keep sentences SHORT - max 15 words each):
   "${firstName}, I've been a big fan of yours."
   
   Then 2-3 SHORT sentences about their specific story/achievement with REAL DATA.
   Example: "Your post about manifestation got ~176~ views in 3 days."
   Break up long sentences. Keep it punchy.

3. TRANSITION:
   "You're a busy person so I'll just cut to the chase:"

4. PROBLEM STATEMENT (One sentence with specific data):
   "Right now, [specific website problem with numbers like ~7.8 seconds load time or ~48% bounce rate]."

5. SOLUTION (Numbered list 1-4, BRIEF):
   "So we took your site and added:
   
   1. A minimal layout that Google loves
   We did this for an agency in Queensland—leads went up 30%, closed a $4.2M project in 2 weeks.
   
   2. Lead Qualification System
   80% of ${analysis.industry || 'creators'} I talk to don't want more leads, they want better leads.
   
   3. Built-in SEO to rank higher on Google
   
   4. After launch, we test and optimize based on data to maximize ROI."

6. CTA:
   "To see the full website, check the PDF attached.
   
   So what do you think? We can have it live within 72 hours.
   
   Koen"

7. P.S.:
   "P.S. 67% of searches start on a phone. Your site is responsive on every device."

CRITICAL RULES:
- NO sentence over 15 words in the hook section
- Break up any long sentences with periods
- Use line breaks between ideas
- Be conversational, direct
- Reference real details from their story
- Use ~numbers~ with tildes for ALL metrics (looks researched)
- DO NOT use special characters like ✦, –, or other unicode symbols
- Use simple ASCII characters only: standard dashes -, percentages %, dollar signs $
- Keep formatting clean and email-friendly
${mutualConnection ? `- MUST mention "I found you through @${mutualConnection}" in subject or opening` : ''}

Return JSON:
{
  "subject": "Subject line based on framework above",
  "body": "Full email body following the exact structure with clean ASCII text only, name signed as Koen"
}`;
  } else if (emailType === 'follow_up_1') {
    userPrompt = `Write the "Made your site live" follow-up email to ${prospectName}.

This is sent 24-48 hours after the initial email if they didn't respond.

Context:
- Mockup Site URL: ${leadData?.mockupSiteUrl || '[Insert Live URL]'}
- Tone: ${analysis.toneKeywords?.join(', ')}

EMAIL STRUCTURE (Under 100 words):

SUBJECT: "Made your site live"

BODY:
"${firstName}, I know you've got a million things going on. Finding time for this is tough.

TBH, I was thinking about you over the weekend and got a little carried away. I was so convinced your work could look incredible that I went ahead and made your site live.

Here it is: [Live URL]

Let me know what you think.

Koen"

RULES:
- Casual, friendly tone
- Show you already did the work
- Remove all friction
- No pressure
- Under 75 words
- Use simple ASCII characters only, no special unicode symbols

Return JSON:
{
  "subject": "Made your site live",
  "body": "Full email body with [Live URL] placeholder, signed as Koen"
}`;
  } else if (emailType === 'follow_up_2') {
    userPrompt = `Write a final gentle follow-up email to ${prospectName}.

This is sent 3-4 days after the "site live" email.

Tone: ${analysis.toneKeywords?.join(', ')}

Keep it under 50 words. Be friendly and give them an easy out.

Example structure:
"${firstName}, 

I'm sure you're swamped. Just wanted to make sure the live site link didn't get buried.

If the timing isn't right, totally understand. Just let me know either way?

Koen"

RULES:
- Under 50 words
- Friendly, no pressure
- Use simple ASCII characters only
- Signed as Koen

Return JSON:
{
  "subject": "Quick follow-up",
  "body": "Full email body signed as Koen"
}`;
  }

  try {
    const models = ['gpt-5.1', 'gpt-5', 'o3', 'gpt-4o'];
    
    for (const model of models) {
      try {
        console.log(`Generating email with ${model}...`);
        const completion = await openai.chat.completions.create({
          model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert cold email copywriter who creates personalized, high-converting outreach emails using proven frameworks. You write conversationally and avoid corporate jargon. Always respond in valid JSON format.'
            },
            {
              role: 'user',
              content: userPrompt
            }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.8,
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) throw new Error('No response from OpenAI');
        
        console.log(`✅ Email generated with ${model}`);
        return JSON.parse(content);
      } catch (err) {
        if (model === 'gpt-4o') throw err;
        console.log(`${model} failed, trying next...`);
      }
    }
    
    throw new Error('All models failed');
  } catch (error) {
    console.error('OpenAI Email Generation Error:', error);
    throw error;
  }
}
