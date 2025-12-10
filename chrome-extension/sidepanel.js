// Side panel logic and API integration

const PERSONAAI_API = 'http://localhost:3000/api/analyze';

// UI elements
const pullBtn = document.getElementById('pullBtn');
const sendBtn = document.getElementById('sendBtn');
const clearBtn = document.getElementById('clearBtn');
const statusMessage = document.getElementById('statusMessage');
const pageTypeLabel = document.getElementById('pageType');

// Field elements
const fields = ['name', 'company', 'email', 'website', 'igHandle', 'profilePicUrl', 'websiteData'];

// Load current lead data on panel open
loadLeadData();
setupFieldListeners();

// Pull button - extract data from current page
pullBtn.addEventListener('click', async () => {
  pullBtn.disabled = true;
  pullBtn.innerHTML = '<span class="spinner"></span> Pulling data...';

  try {
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Send message to content script to extract data
    chrome.tabs.sendMessage(tab.id, { type: 'PULL_FROM_PAGE' }, (response) => {
      if (chrome.runtime.lastError) {
        showStatus('Error: Could not access page. Try refreshing the page.', 'error');
        pullBtn.disabled = false;
        pullBtn.textContent = 'Pull Data from Page';
        return;
      }

      if (response && response.success) {
        showStatus('Data pulled successfully!', 'success');
        loadLeadData(); // Refresh UI
      } else {
        showStatus('Error pulling data', 'error');
      }

      pullBtn.disabled = false;
      pullBtn.textContent = 'Pull Data from Page';
    });
  } catch (error) {
    console.error('Pull error:', error);
    showStatus('Error: ' + error.message, 'error');
    pullBtn.disabled = false;
    pullBtn.textContent = 'Pull Data from Page';
  }
});

// Send button - send to PersonaAI API
sendBtn.addEventListener('click', async () => {
  sendBtn.disabled = true;
  sendBtn.innerHTML = '<span class="spinner"></span> Sending...';

  try {
    // First, collect any manual edits from input fields
    const manualData = {};
    const editableFields = ['name', 'company', 'email', 'website', 'igHandle', 'profilePicUrl'];
    editableFields.forEach(field => {
      const input = document.getElementById(`value-${field}`);
      if (input && input.value) {
        manualData[field] = input.value.trim();
      }
    });

    // Update background with manual edits
    if (Object.keys(manualData).length > 0) {
      await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          type: 'PULL_DATA',
          data: manualData
        }, resolve);
      });
    }

    // Get current lead from background
    chrome.runtime.sendMessage({ type: 'GET_CURRENT_LEAD' }, (response) => {
      if (!response || !response.lead) {
        showStatus('No data to send', 'error');
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send to PersonaAI';
        return;
      }

      const lead = response.lead;

      // Collect current values from input fields (includes manual edits)
      const name = document.getElementById('value-name').value.trim();
      const company = document.getElementById('value-company').value.trim();
      const email = document.getElementById('value-email').value.trim();
      const website = document.getElementById('value-website').value.trim();
      const igHandle = document.getElementById('value-igHandle').value.trim();

      // Prepare payload for API
      const payload = {
        textContent: lead.websiteData || '',
        name: name || lead.name || '',
        email: email || lead.email || '',
        websiteUrl: website || lead.website || '',
        igHandle: igHandle || lead.igHandle || ''
      };

      console.log('Sending to PersonaAI:', payload);

      // Send message to background to make API call (avoids CORS)
      console.log('About to send SEND_TO_PERSONAAI message...');
      chrome.runtime.sendMessage({
        type: 'SEND_TO_PERSONAAI',
        payload: payload
      }, (response) => {
        console.log('Received response from background:', response);
        
        if (chrome.runtime.lastError) {
          console.error('Runtime error:', chrome.runtime.lastError);
          showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
          sendBtn.disabled = false;
          sendBtn.textContent = 'Send to PersonaAI';
          return;
        }
        
        if (!response || !response.success) {
          console.error('API failed:', response);
          showStatus('Error: ' + (response?.error || 'Unknown error'), 'error');
          sendBtn.disabled = false;
          sendBtn.textContent = 'Send to PersonaAI';
          return;
        }

        const result = response.data;
        console.log('API response:', result);

        showStatus('Lead created successfully! Opening in PersonaAI...', 'success');

        // Open the lead in PersonaAI
        if (result.leadId) {
          chrome.tabs.create({ url: `http://localhost:3000/lead/${result.leadId}` });
        }

        // Clear the lead after successful send
        setTimeout(() => {
          chrome.runtime.sendMessage({ type: 'CLEAR_LEAD' }, () => {
            loadLeadData();
            showStatus('Ready for next prospect', 'success');
            sendBtn.disabled = false;
            sendBtn.textContent = 'Send to PersonaAI';
          });
        }, 1500);
      });
    });
  } catch (error) {
    console.error('Send error:', error);
    showStatus('Error: ' + error.message, 'error');
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send to PersonaAI';
  }
});

// Clear button
clearBtn.addEventListener('click', () => {
  if (confirm('Clear all captured data?')) {
    chrome.runtime.sendMessage({ type: 'CLEAR_LEAD' }, () => {
      loadLeadData();
      showStatus('Data cleared', 'success');
    });
  }
});

// Load and display current lead data
function loadLeadData() {
  chrome.runtime.sendMessage({ type: 'GET_CURRENT_LEAD' }, (response) => {
    if (!response || !response.lead) {
      // No lead data
      clearUI();
      return;
    }

    const lead = response.lead;
    console.log('Current lead:', lead);

    // Update page type
    if (lead.igHandle && lead.website) {
      pageTypeLabel.textContent = 'Instagram + Website data captured';
    } else if (lead.igHandle) {
      pageTypeLabel.textContent = 'Instagram profile captured';
    } else if (lead.website) {
      pageTypeLabel.textContent = 'Website data captured';
    } else {
      pageTypeLabel.textContent = 'Ready to capture data';
    }

    // Update each field
    updateField('name', lead.name);
    updateField('company', lead.company);
    updateField('email', lead.email);
    updateField('website', lead.website);
    updateField('igHandle', lead.igHandle);
    updateField('profilePicUrl', lead.profilePicUrl);
    updateField('websiteData', lead.websiteData ? `${Math.round(lead.websiteData.length / 1000)}KB` : null);

    // Enable send button if we have minimum required data
    const hasMinimumData = lead.name || lead.email || lead.company;
    sendBtn.disabled = !hasMinimumData;
  });
}

// Update a single field in the UI
function updateField(fieldName, value) {
  const checkbox = document.getElementById(`check-${fieldName}`);
  const valueEl = document.getElementById(`value-${fieldName}`);

  if (valueEl) {
    if (fieldName === 'websiteData') {
      // Keep websiteData as display-only div
      if (value) {
        checkbox.checked = true;
        valueEl.textContent = value;
        valueEl.className = 'field-value';
      } else {
        checkbox.checked = false;
        valueEl.textContent = 'Not captured';
        valueEl.className = 'field-empty';
      }
    } else {
      // For input fields, set the value
      valueEl.value = value || '';
      if (value) {
        checkbox.checked = true;
      } else {
        checkbox.checked = false;
      }
    }
  }
}

// Save field edits back to background
function setupFieldListeners() {
  const editableFields = ['name', 'company', 'email', 'website', 'igHandle', 'profilePicUrl'];
  
  editableFields.forEach(fieldName => {
    const input = document.getElementById(`value-${fieldName}`);
    if (input) {
      input.addEventListener('blur', () => {
        const value = input.value.trim();
        // Update background with manual edit
        chrome.runtime.sendMessage({
          type: 'PULL_DATA',
          data: { [fieldName]: value || null }
        });
      });
    }
  });
}

// Clear all UI fields
function clearUI() {
  fields.forEach(field => {
    updateField(field, null);
  });
  // Also clear input values
  ['name', 'company', 'email', 'website', 'igHandle', 'profilePicUrl'].forEach(field => {
    const input = document.getElementById(`value-${field}`);
    if (input) input.value = '';
  });
  pageTypeLabel.textContent = 'Ready to capture data';
  sendBtn.disabled = true;
}

// Show status message
function showStatus(message, type = 'success') {
  statusMessage.textContent = message;
  statusMessage.className = `status ${type}`;
  statusMessage.style.display = 'block';

  // Auto-hide after 3 seconds
  setTimeout(() => {
    statusMessage.style.display = 'none';
  }, 3000);
}

// Listen for lead updates from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'LEAD_UPDATED') {
    loadLeadData();
  }
});
