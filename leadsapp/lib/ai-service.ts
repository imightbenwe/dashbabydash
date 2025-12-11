import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { extractInstagramAnalytics, formatAnalyticsForPrompt, type InstagramAnalytics } from './instagram-analytics';
import { logger } from './logger';
import type { InstagramData, GeminiAnalysisResponse, OpenAIAnalysisResponse } from './types';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Google GenAI client (new SDK as of Dec 2025)
const gemini = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export interface CombinedData {
  prospectName: string;
  company: string;
  email?: string;
  instagramData?: InstagramData;
  websiteData?: string;
  substackData?: string;
  threadsData?: string;
  otherData?: string;
}

export async function analyzeWithGemini(data: CombinedData): Promise<GeminiAnalysisResponse> {
  // Extract Instagram analytics if available
  let instagramAnalytics: InstagramAnalytics | null = null;
  let analyticsForPrompt = '';
  
  if (data.instagramData) {
    try {
      instagramAnalytics = extractInstagramAnalytics(data.instagramData);
      analyticsForPrompt = formatAnalyticsForPrompt(instagramAnalytics);
    } catch (error) {
      logger.error('Failed to extract Instagram analytics', error);
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
6. EMAIL OPENING SENTENCE:
   Write one short, natural opening line for a cold email.
   You may only reference one broad theme from the lead's website or Instagram — not multiple.
   The line must sound like someone glanced at their brand, not like someone studied them.
   Do not mention schedules, events, workshops, trainings, pricing, locations, dates, captions, or any detail that feels "insider."
   Do not summarize their offerings.
   Do not restate slogans or taglines.
   Do not tell them what they do; simply acknowledge the general vibe or intention behind their work (rest, nervous system support, sound healing, breathwork, community, etc.).
   Keep the line under 18 words.
   Tone: warm, calm, human, lightly personalized — nothing dramatic or "marketing-y."

Provide a JSON response:
{
  "firstNameGuess": "Most likely first name extracted from the full name (e.g., 'Sarah' from 'Sarah Thompson Wellness')",
  "topCommenter": "${instagramAnalytics?.topCommenterUsername || 'username of most frequent commenter from comments data'}",
  "topCommenterProfilePic": "${instagramAnalytics?.topCommenterProfilePic || 'profile_pic_url from commenter data'}",
  "specificAchievement": "Your [specific post topic] got ~${instagramAnalytics?.mostEngagingPost?.likesCount || 'XX'}~ likes and ~${instagramAnalytics?.mostEngagingPost?.commentsCount || 'XX'}~ comments",
  "specificHookStory": "The detailed, specific story/moment from their life with context and year",
  "toneKeywords": ["keyword1", "keyword2", "keyword3"],
  "storyArc": "Their overall journey narrative in 2-3 sentences",
  "keyTriggers": ["pain point 1", "pain point 2", "pain point 3"],
  "emailOpening": "1-2 warm, natural sentences that feel like a real person briefly explored their work",
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
      console.log('Trying Gemini model: ' + models[i]);
      const response = await gemini.models.generateContent({
        model: models[i],
        contents: prompt,
      });
      
      const text = response.text || '';
      
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        console.log('Successfully used ' + models[i]);
        const result = JSON.parse(jsonMatch[0]);
        
        // Include extracted analytics in response
        return {
          ...result,
          _instagramAnalytics: instagramAnalytics
        };
      }
      
      throw new Error('Failed to parse Gemini response');
    } catch (error) {
      console.error(models[i] + ' failed:', error);
      
      // If this is the last model, throw the error
      if (i === models.length - 1) {
        throw error;
      }
      // Otherwise, continue to next model
      console.log('Falling back to ' + models[i + 1] + '...');
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

  const topCommenterInfo = instagramAnalytics?.topCommenterUsername || 'username of most frequent commenter from comments data';
  const topCommenterPic = instagramAnalytics?.topCommenterProfilePic || 'profile_pic_url from commenter data';
  const likesCount = instagramAnalytics?.mostEngagingPost?.likesCount || 'XX';
  const commentsCount = instagramAnalytics?.mostEngagingPost?.commentsCount || 'XX';
  const engagingTopic = instagramAnalytics?.mostEngagingTopic || 'analyze content to find';

  const prompt = 'You are an expert OSINT researcher analyzing digital presence to find specific, personalized details for cold email outreach.\n\n' +
    'Analyze the following data about ' + data.prospectName + ':\n\n' +
    'Company: ' + (data.company || 'Unknown') + '\n' +
    'Email: ' + (data.email || 'Not provided') + '\n\n' +
    (data.email ? 'Email: ' + data.email + '\n\n' : '') +
    (analyticsForPrompt ? '\n' + analyticsForPrompt + '\n' : '') +
    (data.instagramData ? 'Instagram Posts Data (Full JSON with engagement metrics): ' + JSON.stringify(data.instagramData).substring(0, 5000) : '') +
    (data.websiteData ? '\n\nWebsite Content: ' + data.websiteData.substring(0, 5000) : '') +
    (data.substackData ? '\n\nSubstack Content: ' + data.substackData.substring(0, 2000) : '') +
    (data.threadsData ? '\n\nThreads Content: ' + data.threadsData.substring(0, 2000) : '') +
    (data.otherData ? '\n\nOther Data: ' + data.otherData.substring(0, 1000) : '') +
    '\n\nFind and extract:\n\n' +
    '0. FIRST NAME (REQUIRED - MUST ALWAYS PROVIDE A GUESS): Look through all the data and find what is most likely the person\'s first name. Check email addresses (e.g., "Sonia" from "Sonia@waowellness.com"), website content, about pages, contact info, ANYWHERE. You MUST return your best guess. Never return empty string. If you see an email like "name@domain.com", extract "name". If truly no clues exist, extract the first word from the company name.\n\n' +
    '1. MOST FREQUENT COMMENTER (for mutual connection reference):\n' +
    (instagramAnalytics?.topCommenterUsername ? 
      '   Top commenter identified: @' + instagramAnalytics.topCommenterUsername + ' (' + instagramAnalytics.topCommenterCommentCount + ' comments)\n' : 
      '   Parse the latestComments arrays to find who comments most frequently\n') +
    '\n2. A SPECIFIC defining moment, struggle, or transformation from their life (with year/timeframe if possible):\n' +
    '   - Example: "I heard your story about 2010 when you discovered you were pregnant and had to choose between having a family or a career, then deciding to build your own firm to have both"\n' +
    '   - Example: "I read about that freezing winter in Chicago when you and your girlfriend had to huddle around four tiny space heaters because you didn\'t have $300 to fix the furnace"\n' +
    '   - This should be personal, specific, and demonstrate deep research\n\n' +
    '3. SPECIFIC ACHIEVEMENT with engagement data:\n' +
    '   - Example: "Your post about manifestation and nervous system regulation got ~176~ views and ~35~ likes in just 3 days"\n' +
    '   - Use actual numbers from the Instagram data (likesCount, videoViewCount, commentsCount)\n' +
    '   - Reference their most engaging topic: ' + engagingTopic + '\n\n' +
    '4. Their communication tone and style\n' +
    '5. Their pain points and triggers\n' +
    '6. EMAIL OPENING SENTENCE:\n' +
    '   Write one short, natural opening line for a cold email.\n' +
    '   You may only reference one broad theme from the lead\'s website or Instagram — not multiple.\n' +
    '   The line must sound like someone glanced at their brand, not like someone studied them.\n' +
    '   Do not mention schedules, events, workshops, trainings, pricing, locations, dates, captions, or any detail that feels "insider."\n' +
    '   Do not summarize their offerings.\n' +
    '   Do not restate slogans or taglines.\n' +
    '   Do not tell them what they do; simply acknowledge the general vibe or intention behind their work (rest, nervous system support, sound healing, breathwork, community, etc.).\n' +
    '   Keep the line under 18 words.\n' +
    '   Tone: warm, calm, human, lightly personalized — nothing dramatic or "marketing-y."\n\n' +
    'Return JSON with this structure:\n' +
    '{\n' +
    '  "firstNameGuess": "ALWAYS provide a name here - your best guess from the data, never leave empty",\n' +
    '  "topCommenter": "' + topCommenterInfo + '",\n' +
    '  "topCommenterProfilePic": "' + topCommenterPic + '",\n' +
    '  "specificAchievement": "Your [specific post topic] got ~' + likesCount + '~ likes and ~' + commentsCount + '~ comments",\n' +
    '  "specificHookStory": "The detailed, specific story/moment from their life with context and year",\n' +
    '  "toneKeywords": ["keyword1", "keyword2", "keyword3"],\n' +
    '  "storyArc": "Their overall journey narrative in 2-3 sentences",\n' +
    '  "keyTriggers": ["pain point 1", "pain point 2", "pain point 3"],\n' +
    '  "emailOpening": "1-2 warm, natural sentences that feel like a real person briefly explored their work",\n' +
    '  "engagementInsights": "Pattern you noticed: e.g., \'manifestation content gets 2x more engagement than other topics\'",\n' +
    '  "insights": "Additional insights about their work and achievements"\n' +
    '}';

  // Try latest models with fallback (December 2025)
  const models = [
    'gpt-5.1',                // NEWEST: Latest GPT-5 family (Nov 2025)
    'gpt-5',                  // Fallback 1: Standard GPT-5 (Aug 2025)
    'o3',                     // Fallback 2: Advanced reasoning model
    'gpt-4o',                 // Fallback 3: Reliable GPT-4o
  ];

  for (let i = 0; i < models.length; i++) {
    try {
      console.log('Trying OpenAI model: ' + models[i]);
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
      
      console.log('Successfully used ' + models[i]);
      const result = JSON.parse(content);
      
      // Include extracted analytics in response
      return {
        ...result,
        _instagramAnalytics: instagramAnalytics
      };
    } catch (error) {
      console.error(models[i] + ' failed:', error);
      
      // If this is the last model, throw the error
      if (i === models.length - 1) {
        throw error;
      }
      // Otherwise, continue to next model
      console.log('Falling back to ' + models[i + 1] + '...');
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
    const emailOpening = analysis.emailOpening || 
      'I came across your work and it really resonated with me.';
    
    userPrompt = 'Generate a cold email using EXACTLY this template.\n\n' +
      'EMAIL OPENING (already personalized): ' + emailOpening + '\n\n' +
      'SUBJECT LINE TASK:\n' +
      'Write one short, low-hype subject line based on the opening context.\n' +
      'Max 6-7 words total.\n' +
      'Avoid spammy words (free, discount, urgent, guarantee, etc.).\n' +
      'Examples: "Quick question about your breathwork", "Small idea for your practice"\n\n' +
      'EMAIL BODY:\n' +
      'Hi ' + firstName + ',\n\n' +
      emailOpening + '\n\n' +
      'Quick question: is anything in your online flow currently slowing you down (website, automations, client funnel)?\n\n' +
      'I help spiritual entrepreneurs streamline their systems so they attract more ideal clients with less effort.\n\n' +
      'If you want, I can take a quick look and tell you exactly where the bottleneck is.\n\n' +
      'Would that be useful?\n\n' +
      'Cheers,\n\n' +
      'Return JSON:\n' +
      '{\n' +
      '  "subject": "Your subject line here (6-7 words max)",\n' +
      '  "body": "Hi ' + firstName + ',\\n\\n' + emailOpening + '\\n\\nQuick question: is anything in your online flow currently slowing you down (website, automations, client funnel)?\\n\\nI help spiritual entrepreneurs streamline their systems so they attract more ideal clients with less effort.\\n\\nIf you want, I can take a quick look and tell you exactly where the bottleneck is.\\n\\nWould that be useful?\\n\\nCheers,"\n' +
      '}';
  } else if (emailType === 'follow_up_1') {
    userPrompt = 'Write the "Made your site live" follow-up email to ' + prospectName + '.\n\n' +
      'This is sent 24-48 hours after the initial email if they didn\'t respond.\n\n' +
      'Context:\n' +
      '- Mockup Site URL: ' + (leadData?.mockupSiteUrl || '[Insert Live URL]') + '\n' +
      '- Tone: ' + (analysis.toneKeywords?.join(', ') || 'professional') + '\n\n' +
      'EMAIL STRUCTURE (Under 100 words):\n\n' +
      'SUBJECT: "Made your site live"\n\n' +
      'BODY:\n' +
      '"' + firstName + ', I know you\'ve got a million things going on. Finding time for this is tough.\n\n' +
      'TBH, I was thinking about you over the weekend and got a little carried away. I was so convinced your work could look incredible that I went ahead and made your site live.\n\n' +
      'Here it is: [Live URL]\n\n' +
      'Let me know what you think.\n\n' +
      'Koen"\n\n' +
      'RULES:\n' +
      '- Casual, friendly tone\n' +
      '- Show you already did the work\n' +
      '- Remove all friction\n' +
      '- No pressure\n' +
      '- Under 75 words\n' +
      '- Use simple ASCII characters only, no special unicode symbols\n\n' +
      'Return JSON:\n' +
      '{\n' +
      '  "subject": "Made your site live",\n' +
      '  "body": "Full email body with [Live URL] placeholder, signed as Koen"\n' +
      '}';
  } else if (emailType === 'follow_up_2') {
    userPrompt = 'Write a final gentle follow-up email to ' + prospectName + '.\n\n' +
      'This is sent 3-4 days after the "site live" email.\n\n' +
      'Tone: ' + (analysis.toneKeywords?.join(', ') || 'professional') + '\n\n' +
      'Keep it under 50 words. Be friendly and give them an easy out.\n\n' +
      'Example structure:\n' +
      '"' + firstName + ', \n\n' +
      'I\'m sure you\'re swamped. Just wanted to make sure the live site link didn\'t get buried.\n\n' +
      'If the timing isn\'t right, totally understand. Just let me know either way?\n\n' +
      'Koen"\n\n' +
      'RULES:\n' +
      '- Under 50 words\n' +
      '- Friendly, no pressure\n' +
      '- Use simple ASCII characters only\n' +
      '- Signed as Koen\n\n' +
      'Return JSON:\n' +
      '{\n' +
      '  "subject": "Quick follow-up",\n' +
      '  "body": "Full email body signed as Koen"\n' +
      '}';
  }

  try {
    const models = ['gpt-5.1', 'gpt-5', 'o3', 'gpt-4o'];
    
    for (const model of models) {
      try {
        console.log('Generating email with ' + model + '...');
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
        
        console.log('Email generated with ' + model);
        return JSON.parse(content);
      } catch (err) {
        if (model === 'gpt-4o') throw err;
        console.log(model + ' failed, trying next...');
      }
    }
    
    throw new Error('All models failed');
  } catch (error) {
    console.error('OpenAI Email Generation Error:', error);
    throw error;
  }
}
