/**
 * Instagram Analytics Extractor
 * Parses Instagram JSON (full.json format) to extract engagement metrics and insights
 */

export interface InstagramPost {
  id: string;
  caption: string;
  ownerUsername: string;
  latestComments: Array<{
    ownerUsername: string;
    text: string;
    timestamp: string;
    likesCount: number;
    owner?: {
      profile_pic_url?: string;
    };
  }>;
  likesCount: number;
  commentsCount: number;
  videoViewCount?: number;
  timestamp: string;
  type?: string;
}

export interface InstagramAnalytics {
  topCommenterUsername: string | null;
  topCommenterProfilePic: string | null;
  topCommenterCommentCount: number;
  engagementAvgLikes: number;
  engagementAvgComments: number;
  engagementAvgViews: number;
  totalPostsAnalyzed: number;
  mostEngagingTopic: string | null;
  mostEngagingPost: {
    caption: string;
    likesCount: number;
    commentsCount: number;
    timestamp: string;
  } | null;
  recentPostDate: string | null;
  commenterInsights: Array<{
    username: string;
    commentCount: number;
    profilePic: string;
  }>;
  contentPatterns: {
    averageEngagementRate: number;
    topicsByEngagement: Array<{ topic: string; avgLikes: number }>;
  };
  personalDetails: {
    location: string | null;
    hobbies: string[];
    pets: string[];
    struggles: string[];
    personalMentions: string[];
  };
  personalStoryHook: string | null;
  audiencePainPoints: string[];
  specificPostTopics: Array<{
    topic: string;
    engagement: number;
    timestamp: string;
  }>;
}

/**
 * Extract comprehensive Instagram analytics from full.json format
 */
export function extractInstagramAnalytics(instagramData: any): InstagramAnalytics {
  // Handle both array and object formats
  const posts: InstagramPost[] = Array.isArray(instagramData) 
    ? instagramData 
    : instagramData.posts || [];

  if (posts.length === 0) {
    return getEmptyAnalytics();
  }

  // 1. Find most frequent commenter
  const commenterMap = new Map<string, { count: number; profilePic: string }>();
  
  posts.forEach(post => {
    if (post.latestComments && Array.isArray(post.latestComments)) {
      post.latestComments.forEach(comment => {
        if (comment.ownerUsername && comment.ownerUsername !== post.ownerUsername) {
          const current = commenterMap.get(comment.ownerUsername) || { count: 0, profilePic: '' };
          commenterMap.set(comment.ownerUsername, {
            count: current.count + 1,
            profilePic: comment.owner?.profile_pic_url || current.profilePic
          });
        }
      });
    }
  });

  // Sort commenters by count
  const sortedCommenters = Array.from(commenterMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .map(([username, data]) => ({
      username,
      commentCount: data.count,
      profilePic: data.profilePic
    }));

  const topCommenter = sortedCommenters[0] || null;

  // 2. Calculate engagement averages
  let totalLikes = 0;
  let totalComments = 0;
  let totalViews = 0;
  let postsWithViews = 0;

  posts.forEach(post => {
    totalLikes += post.likesCount || 0;
    totalComments += post.commentsCount || 0;
    if (post.videoViewCount) {
      totalViews += post.videoViewCount;
      postsWithViews++;
    }
  });

  const engagementAvgLikes = Math.round(totalLikes / posts.length);
  const engagementAvgComments = Math.round(totalComments / posts.length);
  const engagementAvgViews = postsWithViews > 0 ? Math.round(totalViews / postsWithViews) : 0;

  // 3. Find most engaging post
  const mostEngagingPost = posts.reduce((max, post) => {
    const engagement = (post.likesCount || 0) + (post.commentsCount || 0) * 2;
    const maxEngagement = (max?.likesCount || 0) + (max?.commentsCount || 0) * 2;
    return engagement > maxEngagement ? post : max;
  }, posts[0]);

  // 4. Extract topic from most engaging post
  const mostEngagingTopic = extractTopicFromCaption(mostEngagingPost?.caption || '');

  // 5. Find most recent post date
  const recentPostDate = posts.reduce((latest, post) => {
    if (!post.timestamp) return latest;
    if (!latest) return post.timestamp;
    return new Date(post.timestamp) > new Date(latest) ? post.timestamp : latest;
  }, posts[0]?.timestamp || null);

  // 6. Calculate content patterns
  const topicEngagementMap = new Map<string, { totalLikes: number; count: number }>();
  
  posts.forEach(post => {
    const topic = extractTopicFromCaption(post.caption || '');
    if (topic) {
      const current = topicEngagementMap.get(topic) || { totalLikes: 0, count: 0 };
      topicEngagementMap.set(topic, {
        totalLikes: current.totalLikes + (post.likesCount || 0),
        count: current.count + 1
      });
    }
  });

  const topicsByEngagement = Array.from(topicEngagementMap.entries())
    .map(([topic, data]) => ({
      topic,
      avgLikes: Math.round(data.totalLikes / data.count)
    }))
    .sort((a, b) => b.avgLikes - a.avgLikes)
    .slice(0, 5);

  const totalEngagement = totalLikes + totalComments;
  const averageEngagementRate = posts.length > 0 ? totalEngagement / posts.length : 0;

  // 7. Extract personal details from captions
  const personalDetails = extractPersonalDetails(posts);

  // 8. Extract personal story hook (first-person narrative)
  const personalStoryHook = extractPersonalStoryHook(posts);

  // 9. Extract audience pain points from comments
  const audiencePainPoints = extractAudiencePainPoints(posts);

  // 10. Extract specific post topics for email subject lines
  const specificPostTopics = extractSpecificPostTopics(posts);

  return {
    topCommenterUsername: topCommenter?.username || null,
    topCommenterProfilePic: topCommenter?.profilePic || null,
    topCommenterCommentCount: topCommenter?.commentCount || 0,
    engagementAvgLikes,
    engagementAvgComments,
    engagementAvgViews,
    totalPostsAnalyzed: posts.length,
    mostEngagingTopic,
    mostEngagingPost: mostEngagingPost ? {
      caption: mostEngagingPost.caption?.substring(0, 200) || '',
      likesCount: mostEngagingPost.likesCount || 0,
      commentsCount: mostEngagingPost.commentsCount || 0,
      timestamp: mostEngagingPost.timestamp || ''
    } : null,
    recentPostDate,
    commenterInsights: sortedCommenters.slice(0, 10),
    contentPatterns: {
      averageEngagementRate,
      topicsByEngagement
    },
    personalDetails,
    personalStoryHook,
    audiencePainPoints,
    specificPostTopics
  };
}

/**
 * Extract specific post topics for email subject lines
 * Extracts very specific topics from individual posts, not generic themes
 */
function extractSpecificPostTopics(posts: InstagramPost[]): Array<{
  topic: string;
  engagement: number;
  timestamp: string;
}> {
  const topicCandidates: Array<{
    topic: string;
    engagement: number;
    timestamp: string;
  }> = [];

  // Sort posts by engagement
  const sortedPosts = [...posts].sort((a, b) => {
    const aEngagement = (a.likesCount || 0) + (a.commentsCount || 0) * 2;
    const bEngagement = (b.likesCount || 0) + (b.commentsCount || 0) * 2;
    return bEngagement - aEngagement;
  });

  // Process top posts to extract specific topics
  for (const post of sortedPosts.slice(0, 30)) {
    if (!post.caption || post.caption.length < 20) continue;

    const engagement = (post.likesCount || 0) + (post.commentsCount || 0) * 2;
    
    // Extract first sentence or first meaningful phrase (very specific)
    const cleanCaption = post.caption
      .replace(/[\r\n]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s',.-]/g, '')
      .trim();

    // Try to get the first sentence
    const sentences = cleanCaption.split(/[.!?]\s+/);
    const firstSentence = sentences[0];

    if (firstSentence && firstSentence.length > 15 && firstSentence.length < 100) {
      // Check if it's specific enough (not too generic)
      const genericTerms = ['manifestation', 'alignment', 'abundance', 'spiritual', 'growth'];
      const isGeneric = genericTerms.some(term => 
        firstSentence.toLowerCase().includes(term) && firstSentence.split(' ').length < 5
      );

      if (!isGeneric) {
        topicCandidates.push({
          topic: firstSentence,
          engagement,
          timestamp: post.timestamp
        });
      }
    } else {
      // Try to extract a specific phrase (look for patterns)
      const patterns = [
        /(?:the|a|an) ([^.,!?]{15,80})/i,
        /(?:how|why|when|what) ([^.,!?]{15,80})/i,
        /(?:I discovered|I learned|I realized) ([^.,!?]{15,80})/i,
        /([^.,!?]{20,80}) (?:changed everything|was a game changer|transformed)/i,
      ];

      for (const pattern of patterns) {
        const match = cleanCaption.match(pattern);
        if (match && match[0] && match[0].length > 15) {
          topicCandidates.push({
            topic: match[0].trim(),
            engagement,
            timestamp: post.timestamp
          });
          break;
        }
      }
    }
  }

  // Deduplicate similar topics
  const uniqueTopics: Array<{
    topic: string;
    engagement: number;
    timestamp: string;
  }> = [];

  for (const candidate of topicCandidates) {
    const isDuplicate = uniqueTopics.some(existing => {
      const similarity = calculateSimilarity(existing.topic.toLowerCase(), candidate.topic.toLowerCase());
      return similarity > 0.6;
    });

    if (!isDuplicate) {
      uniqueTopics.push(candidate);
    }

    if (uniqueTopics.length >= 5) break;
  }

  return uniqueTopics.slice(0, 5);
}

/**
 * Calculate similarity between two strings (simple Jaccard similarity)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.split(/\s+/));
  const words2 = new Set(str2.split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

/**
 * Extract personal story hook from first-person narratives
 * Looks for 'I' or 'my' statements about struggles, realizations, or turning points
 */
function extractPersonalStoryHook(posts: InstagramPost[]): string | null {
  const firstPersonPatterns = [
    /when I (first )?(started|began|tried|realized|discovered|hit|felt|experienced|struggled with|couldn't|didn't know) ([^.!?]{10,150})/gi,
    /I (used to|was|had|couldn't|didn't|thought|believed|felt like|hit|experienced) ([^.!?]{10,150})/gi,
    /my (journey|struggle|realization|breakthrough|turning point|story|experience) (with|was|started|began) ([^.!?]{10,150})/gi,
    /but then[,]? I ([^.!?]{10,150})/gi,
    /I'd (hit|reach|get to|experience|feel) ([^.!?]{10,150})/gi,
    /before I (knew|understood|realized|discovered|learned) ([^.!?]{10,150})/gi,
  ];

  // Sort posts by engagement (likes + comments) to prioritize high-performing content
  const sortedPosts = [...posts].sort((a, b) => {
    const aEngagement = (a.likesCount || 0) + (a.commentsCount || 0);
    const bEngagement = (b.likesCount || 0) + (b.commentsCount || 0);
    return bEngagement - aEngagement;
  });

  // Look through top posts for compelling first-person narratives
  for (const post of sortedPosts.slice(0, 20)) {
    if (!post.caption) continue;
    
    for (const pattern of firstPersonPatterns) {
      const match = post.caption.match(pattern);
      if (match && match[0]) {
        // Clean up the extracted text
        let hook = match[0]
          .replace(/\s+/g, ' ')
          .replace(/[\r\n]+/g, ' ')
          .trim();
        
        // Make sure it's substantial enough
        if (hook.length > 20 && hook.length < 200) {
          // Capitalize first letter
          hook = hook.charAt(0).toUpperCase() + hook.slice(1);
          return hook;
        }
      }
    }
  }

  return null;
}

/**
 * Extract audience pain points from comment sentiment analysis
 * Analyzes latestComments to identify what the audience is asking for/struggling with
 */
function extractAudiencePainPoints(posts: InstagramPost[]): string[] {
  const painPointKeywords = [
    'struggling', 'struggle', 'stuck', 'can\'t', 'cannot', 'help', 'need', 'needed',
    'hard', 'difficult', 'challenge', 'problem', 'issue', 'frustrated', 'anxiety',
    'scared', 'fear', 'worried', 'confused', 'lost', 'overwhelmed', 'exhausted',
    'trying to', 'how do I', 'how to', 'help me', 'advice', 'tips'
  ];

  const supportKeywords = [
    'this is exactly', 'I needed this', 'soooo needed', 'relate', 'same here',
    'me too', 'thank you', 'helped me', 'resonates', 'feel seen'
  ];

  const painPoints: string[] = [];
  const allComments: string[] = [];

  // Collect all comments from all posts
  posts.forEach(post => {
    if (post.latestComments && Array.isArray(post.latestComments)) {
      post.latestComments.forEach(comment => {
        if (comment.text) {
          allComments.push(comment.text.toLowerCase());
        }
      });
    }
  });

  // Extract pain points
  allComments.forEach(comment => {
    // Check for direct pain point mentions
    painPointKeywords.forEach(keyword => {
      if (comment.includes(keyword)) {
        // Extract context around the keyword
        const words = comment.split(' ');
        const keywordIndex = words.findIndex(w => w.includes(keyword));
        if (keywordIndex !== -1) {
          const start = Math.max(0, keywordIndex - 3);
          const end = Math.min(words.length, keywordIndex + 7);
          const context = words.slice(start, end).join(' ');
          if (context.length > 15 && context.length < 100) {
            painPoints.push(context);
          }
        }
      }
    });

    // Check for support keywords indicating validation of pain points
    supportKeywords.forEach(keyword => {
      if (comment.includes(keyword)) {
        // This suggests high engagement and resonance
        const summary = comment.substring(0, 80);
        if (summary.length > 15) {
          painPoints.push(`Highly engaged: "${summary}"`);
        }
      }
    });
  });

  // Deduplicate and limit
  return [...new Set(painPoints)].slice(0, 10);
}

/**
 * Extract personal details from Instagram captions
 */
function extractPersonalDetails(posts: InstagramPost[]): {
  location: string | null;
  hobbies: string[];
  pets: string[];
  struggles: string[];
  personalMentions: string[];
} {
  const allText = posts.map(p => p.caption || '').join(' ').toLowerCase();
  
  // Extract location mentions
  const locationPatterns = [
    /in\s+(new york|los angeles|chicago|miami|london|paris|sydney|melbourne|toronto|vancouver)/i,
    /from\s+(new york|los angeles|chicago|miami|london|paris|sydney|melbourne|toronto|vancouver)/i,
    /living in\s+([a-z\s]+)/i,
    /based in\s+([a-z\s]+)/i,
  ];
  
  let location = null;
  for (const pattern of locationPatterns) {
    const match = posts.map(p => p.caption || '').join(' ').match(pattern);
    if (match && match[1]) {
      location = match[1];
      break;
    }
  }
  
  // Extract hobbies
  const hobbyKeywords = ['yoga', 'meditation', 'running', 'hiking', 'cooking', 'reading', 'writing', 
    'painting', 'photography', 'travel', 'fitness', 'dancing', 'music', 'gardening'];
  const hobbies = hobbyKeywords.filter(hobby => allText.includes(hobby));
  
  // Extract pet mentions
  const petKeywords = ['dog', 'cat', 'puppy', 'kitten', 'pet', 'furry friend', 'rescue'];
  const pets: string[] = [];
  petKeywords.forEach(pet => {
    if (allText.includes(pet)) {
      pets.push(pet);
    }
  });
  
  // Extract struggles and challenges (MOST IMPORTANT)
  const strugglePatterns = [
    /struggle(?:d|s)? with ([^.!?]+)/gi,
    /challenge(?:d|s)? (?:of|with) ([^.!?]+)/gi,
    /difficult(?:y)? ([^.!?]+)/gi,
    /hard(?:est)? (?:part|time) ([^.!?]+)/gi,
    /used to ([^.!?]+) but/gi,
    /was ([^.!?]+) until/gi,
    /couldn't ([^.!?]+)/gi,
    /didn't know how to ([^.!?]+)/gi,
    /felt ([^.!?]+) when/gi,
    /pain of ([^.!?]+)/gi,
    /broke down ([^.!?]+)/gi,
    /hitting rock bottom ([^.!?]+)/gi,
    /that moment when ([^.!?]+)/gi,
  ];
  
  const struggles: string[] = [];
  const fullText = posts.map(p => p.caption || '').join(' ');
  
  strugglePatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(fullText)) !== null) {
      if (match[1] && match[1].length > 5 && match[1].length < 100) {
        struggles.push(match[1].trim());
      }
    }
  });
  
  // Extract personal story mentions (years, specific moments)
  const personalMentions: string[] = [];
  const yearPattern = /(?:in |back in |year )(19\d{2}|20\d{2})/gi;
  let yearMatch;
  while ((yearMatch = yearPattern.exec(fullText)) !== null) {
    const context = fullText.substring(Math.max(0, yearMatch.index - 50), yearMatch.index + 100);
    personalMentions.push(context.trim());
  }
  
  return {
    location,
    hobbies: [...new Set(hobbies)].slice(0, 5),
    pets: [...new Set(pets)].slice(0, 3),
    struggles: [...new Set(struggles)].slice(0, 10),
    personalMentions: [...new Set(personalMentions)].slice(0, 5),
  };
}

/**
 * Extract main topic/theme from Instagram caption
 */
function extractTopicFromCaption(caption: string): string | null {
  if (!caption) return null;

  // Common topic keywords to look for
  const topics = [
    'manifestation', 'mindset', 'healing', 'self-love', 'alignment', 'abundance',
    'spiritual', 'growth', 'transformation', 'entrepreneurship', 'business',
    'wellness', 'meditation', 'coaching', 'personal development', 'success',
    'relationships', 'confidence', 'purpose', 'goals', 'motivation',
    'nervous system', 'subconscious', 'limiting beliefs', 'identity'
  ];

  const lowerCaption = caption.toLowerCase();
  
  // Find topics mentioned in caption
  const foundTopics = topics.filter(topic => lowerCaption.includes(topic));
  
  // Return most relevant topic (prioritize earlier mentions)
  if (foundTopics.length > 0) {
    return foundTopics[0].charAt(0).toUpperCase() + foundTopics[0].slice(1);
  }

  // Fallback: extract first meaningful phrase (remove emojis, trim)
  const cleanCaption = caption.replace(/[^\w\s]/gi, ' ').trim();
  const firstSentence = cleanCaption.split(/[.!?]/)[0];
  
  if (firstSentence && firstSentence.length > 10 && firstSentence.length < 80) {
    return firstSentence.substring(0, 60);
  }

  return null;
}

/**
 * Get empty analytics object when no data available
 */
function getEmptyAnalytics(): InstagramAnalytics {
  return {
    topCommenterUsername: null,
    topCommenterProfilePic: null,
    topCommenterCommentCount: 0,
    engagementAvgLikes: 0,
    engagementAvgComments: 0,
    engagementAvgViews: 0,
    totalPostsAnalyzed: 0,
    mostEngagingTopic: null,
    mostEngagingPost: null,
    recentPostDate: null,
    commenterInsights: [],
    contentPatterns: {
      averageEngagementRate: 0,
      topicsByEngagement: []
    },
    personalDetails: {
      location: null,
      hobbies: [],
      pets: [],
      struggles: [],
      personalMentions: []
    },
    personalStoryHook: null,
    audiencePainPoints: [],
    specificPostTopics: []
  };
}

/**
 * Format analytics for AI prompt
 */
export function formatAnalyticsForPrompt(analytics: InstagramAnalytics): string {
  if (analytics.totalPostsAnalyzed === 0) {
    return 'No Instagram analytics available.';
  }

  const personalDetailsSection = analytics.personalDetails ? `

PERSONAL DETAILS EXTRACTED FROM CAPTIONS:
${analytics.personalDetails.location ? `- Location: ${analytics.personalDetails.location}` : ''}
${analytics.personalDetails.hobbies.length > 0 ? `- Hobbies/Interests: ${analytics.personalDetails.hobbies.join(', ')}` : ''}
${analytics.personalDetails.pets.length > 0 ? `- Pets: ${analytics.personalDetails.pets.join(', ')}` : ''}
${analytics.personalDetails.struggles.length > 0 ? `- STRUGGLES/CHALLENGES (USE THESE FOR EMAIL HOOKS):\n  ${analytics.personalDetails.struggles.map(s => `* "${s}"`).join('\n  ')}` : ''}
${analytics.personalDetails.personalMentions.length > 0 ? `- Personal Story Moments:\n  ${analytics.personalDetails.personalMentions.slice(0, 3).map(m => `* ${m}`).join('\n  ')}` : ''}
` : '';

  const storyHookSection = analytics.personalStoryHook ? `

PERSONAL STORY HOOK FOR EMAIL:
"${analytics.personalStoryHook}"

USAGE EXAMPLE: "Ever since I heard your story about ${analytics.personalStoryHook.toLowerCase()}..."
` : '';

  const audiencePainSection = analytics.audiencePainPoints.length > 0 ? `

AUDIENCE PAIN POINTS (from comments):
${analytics.audiencePainPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

INSIGHT: They have a highly engaged audience that may be under-monetized or not effectively captured.
` : '';

  const specificTopicsSection = analytics.specificPostTopics.length > 0 ? `

SPECIFIC POST TOPICS (for Email Subject Lines):
${analytics.specificPostTopics.map((t, i) => `${i + 1}. "${t.topic}" (${t.engagement} engagement)`).join('\n')}

EMAIL SUBJECT LINE IDEAS:
- "Your post about ${analytics.specificPostTopics[0]?.topic.toLowerCase()}"
- "Quick question re: ${analytics.specificPostTopics[1]?.topic.toLowerCase() || analytics.specificPostTopics[0]?.topic.toLowerCase()}"
` : '';

  return `
INSTAGRAM ENGAGEMENT ANALYTICS (${analytics.totalPostsAnalyzed} posts analyzed):

Top Commenter: ${analytics.topCommenterUsername ? `@${analytics.topCommenterUsername} (${analytics.topCommenterCommentCount} comments)` : 'N/A'}

Engagement Metrics:
- Average Likes: ~${analytics.engagementAvgLikes}~
- Average Comments: ~${analytics.engagementAvgComments}~
${analytics.engagementAvgViews > 0 ? `- Average Video Views: ~${analytics.engagementAvgViews}~` : ''}

Most Engaging Content:
- Topic: ${analytics.mostEngagingTopic || 'N/A'}
${analytics.mostEngagingPost ? `- Best Post: ${analytics.mostEngagingPost.likesCount} likes, ${analytics.mostEngagingPost.commentsCount} comments
  Caption: "${analytics.mostEngagingPost.caption}..."` : ''}

Recent Activity: ${analytics.recentPostDate ? new Date(analytics.recentPostDate).toLocaleDateString() : 'N/A'}

Content Patterns:
${analytics.contentPatterns.topicsByEngagement.slice(0, 3).map(t => 
  `- ${t.topic}: ~${t.avgLikes}~ avg likes`
).join('\n')}
${personalDetailsSection}
${storyHookSection}
${audiencePainSection}
${specificTopicsSection}
`.trim();
}
