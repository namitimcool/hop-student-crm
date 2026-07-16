// ---------------------------------------------------------------------------
// AI Generator (Recruitment CRM) — no paid AI API of any kind.
// Every message is produced entirely offline from these templates. There
// is no OpenAI (or any other LLM) call anywhere in this module.
// ---------------------------------------------------------------------------

function firstName(fullName) {
  if (!fullName) return 'there';
  return fullName.trim().split(' ')[0];
}

function buildFallback(kind, candidate) {
  const name = firstName(candidate.name);
  const role = candidate.currentCompany ? `at ${candidate.currentCompany}` : 'in your current role';
  const skills = (candidate.skills || []).slice(0, 3).join(', ') || 'your background';

  const templates = {
    whatsapp: `Hi ${name}! 👋 This is House of Projects Recruitment. Came across your profile (${skills}) and think you'd be a great fit for a role we're hiring for. Would you be open to a quick chat about it?`,
    email: `Subject: An opportunity that matches your profile, ${name}\n\nHi ${name},\n\nHope things are going well ${role}. I'm reaching out from House of Projects because your experience with ${skills} lines up closely with a role we're currently hiring for.\n\nI'd love to share more details and see if it's a fit — would you have 15 minutes this week for a quick call?\n\nLooking forward to hearing from you.\n\nWarm regards,\nHouse of Projects Recruitment Team`,
    call_script: `Opening: "Hi ${name}, this is calling from House of Projects Recruitment, do you have 2 minutes?"\n\nContext: Mention their experience ${role} and that it's a strong match for a role you're hiring for.\n\nKey points to cover:\n- Confirm their current notice period and CTC expectations\n- Briefly describe the role, company, and compensation range\n- Gauge genuine interest before pushing forward\n- Address any hesitation warmly, don't be pushy\n\nClosing: Confirm next step (sharing JD, scheduling an interview) in writing over WhatsApp/email.`,
    followup: `Hi ${name}, just checking in! Following up on the role we discussed. Have you had a chance to think it over? Happy to answer any questions before we finalize the shortlist.`,
    meeting_notes: `Meeting Notes — ${candidate.name}\nCurrent: ${candidate.currentCompany || 'N/A'} | Experience: ${candidate.experience || 'N/A'}\n\nDiscussion Summary:\n- Current status: ${candidate.status || 'New'}\n- Notice period: ${candidate.noticePeriod || 'Not confirmed'}\n- Key topics discussed: (add notes here)\n\nNext Steps:\n- (add follow-up action)\n\nFollow-up date: ${candidate.nextFollowUp || 'TBD'}`,
    summary: `${candidate.name} has ${candidate.experience || 'unspecified'} experience, currently ${candidate.currentCompany ? `at ${candidate.currentCompany}` : 'between roles'}. Status: "${candidate.status || 'New'}". Notice period: ${candidate.noticePeriod || 'not confirmed'}. Expected CTC: ${candidate.expectedCTC || 'not shared'}.`,
    next_action: candidate.status === 'Interview Scheduled'
      ? 'Confirm interview logistics with the candidate 24 hours in advance.'
      : 'Share this candidate with a matching open position and log the outreach.',
  };

  return templates[kind] || 'Unable to generate message.';
}

// Kept async + same return shape ({ text, source }) so server/routes/ai.js
// (an API route we're not allowed to change) doesn't need any changes.
async function generateMessage(kind, candidate) {
  return { text: buildFallback(kind, candidate), source: 'template' };
}

module.exports = { generateMessage };
