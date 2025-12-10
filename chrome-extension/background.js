// Background service worker
// Manages lead state and communication between content scripts and side panel

let currentLead = null;

// Generate unique ID for new lead
function generateLeadId() {
  return 'lead_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Initialize or get current lead
function getOrCreateLead() {
  if (!currentLead) {
    currentLead = {
      id: generateLeadId(),
      name: null,
      email: null,
      website: null,
      company: null,
      igHandle: null,
      profilePicUrl: null,
      websiteData: null,
      timestamp: Date.now()
    };
  }
  return currentLead;
}

// Listen for messages from content script and side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message.type, message);

  if (message.type === 'PULL_DATA') {
    const lead = getOrCreateLead();
    
    // Merge new data into current lead
    if (message.data.name) lead.name = message.data.name;
    if (message.data.email) lead.email = message.data.email;
    if (message.data.website) lead.website = message.data.website;
    if (message.data.company) lead.company = message.data.company;
    if (message.data.igHandle) lead.igHandle = message.data.igHandle;
    if (message.data.profilePicUrl) lead.profilePicUrl = message.data.profilePicUrl;
    if (message.data.websiteData) lead.websiteData = message.data.websiteData;

    // Save to storage
    chrome.storage.local.set({ currentLead: lead });

    // Notify side panel to update
    chrome.runtime.sendMessage({ type: 'LEAD_UPDATED', lead });

    sendResponse({ success: true, lead });
    return true;
  }

  if (message.type === 'GET_CURRENT_LEAD') {
    sendResponse({ lead: currentLead });
    return true;
  }

  if (message.type === 'CLEAR_LEAD') {
    currentLead = null;
    chrome.storage.local.remove('currentLead');
    chrome.runtime.sendMessage({ type: 'LEAD_CLEARED' });
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'SEND_TO_PERSONAAI') {
    console.log('Background received SEND_TO_PERSONAAI request');
    console.log('Payload:', message.payload);
    
    // Make API call from background to avoid CORS
    (async () => {
      try {
        console.log('Making fetch request to http://localhost:3000/api/analyze');
        
        // Use URLSearchParams for application/x-www-form-urlencoded
        const formBody = new URLSearchParams();
        if (message.payload.name) formBody.append('prospectName', message.payload.name);
        if (message.payload.email) formBody.append('email', message.payload.email);
        if (message.payload.websiteUrl) formBody.append('websiteUrl', message.payload.websiteUrl);
        if (message.payload.igHandle) formBody.append('igHandle', message.payload.igHandle);
        if (message.payload.profilePictureUrl) formBody.append('profilePictureUrl', message.payload.profilePictureUrl);
        if (message.payload.textContent) formBody.append('websiteData', message.payload.textContent);
        
        console.log('Form body created');
        
        const response = await fetch('http://localhost:3000/api/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formBody.toString()
        });

        console.log('Fetch response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('API error response:', errorText);
          throw new Error(`API error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log('API success result:', result);
        sendResponse({ success: true, data: result });
      } catch (error) {
        console.error('API call failed:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep channel open for async
  }

  // Default: unknown message type
  console.warn('Unknown message type:', message.type);
  return false;
});

// Load lead from storage on startup
chrome.storage.local.get(['currentLead'], (result) => {
  if (result.currentLead) {
    // Only restore if less than 1 hour old
    const age = Date.now() - result.currentLead.timestamp;
    if (age < 3600000) {
      currentLead = result.currentLead;
    } else {
      chrome.storage.local.remove('currentLead');
    }
  }
});

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

console.log('PersonaAI Capture background script loaded');
