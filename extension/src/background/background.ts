// Open side panel when toolbar icon is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Create 14-day check-in reminder alarm
chrome.alarms.create('checkin-reminder', { periodInMinutes: 20160 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkin-reminder') {
    chrome.action.setBadgeText({ text: '1' });
    chrome.action.setBadgeBackgroundColor({ color: '#EF4444' });
  }
  if (alarm.name === 'checkin-followup') {
    chrome.storage.local.get(['afloat_followup_flag'], (result) => {
      if (!result.afloat_followup_flag) {
        chrome.action.setBadgeText({ text: '!' });
        chrome.action.setBadgeBackgroundColor({ color: '#f97316' });
        chrome.storage.local.set({ afloat_followup_flag: true });
      }
    });
  }
});

chrome.runtime.onMessage.addListener((msg: { type: string }) => {
  if (msg.type === 'CLEAR_BADGE') {
    chrome.action.setBadgeText({ text: '' });
    chrome.storage.local.remove(['afloat_followup_flag']);
  }
  if (msg.type === 'SET_FOLLOWUP_ALARM') {
    chrome.alarms.create('checkin-followup', { delayInMinutes: 2880 });
  }
});
