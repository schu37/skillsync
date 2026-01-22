import React from 'react';
import LegalPage from '../components/LegalPage';

const PrivacyPolicy: React.FC = () => {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="January 22, 2026">
      <h2>1. Introduction</h2>
      <p>
        SkillSync ("we", "our", or "the Service") is committed to protecting your privacy. 
        This Privacy Policy explains how we collect, use, and safeguard your information when 
        you use our educational video learning platform.
      </p>

      <h2>2. Information We Collect</h2>
      
      <h3>2.1 Information Stored Locally</h3>
      <p>
        SkillSync is designed as a local-first application. The following data is stored 
        only in your browser's local storage and is never transmitted to our servers:
      </p>
      <ul>
        <li>YouTube video URLs you analyze</li>
        <li>Generated lesson plans and questions</li>
        <li>Your answers and evaluation scores</li>
        <li>User preferences and settings</li>
        <li>Session history and progress</li>
      </ul>

      <h3>2.2 Information Sent to Third Parties</h3>
      <p>
        To provide our service, we send data to the following third-party services:
      </p>
      <ul>
        <li>
          <strong>Google Gemini API:</strong> YouTube URLs are sent to Google's Gemini API 
          for video analysis and content generation. This is subject to Google's privacy policy.
        </li>
        <li>
          <strong>YouTube:</strong> We embed YouTube videos using the YouTube IFrame API, 
          subject to YouTube's privacy policy.
        </li>
        <li>
          <strong>Google OAuth (Optional):</strong> If you choose to export to Google Docs, 
          we request access to your Google account with limited scopes for document creation.
        </li>
      </ul>

      <h2>3. How We Use Your Information</h2>
      <p>Your information is used to:</p>
      <ul>
        <li>Generate personalized learning experiences from videos</li>
        <li>Evaluate your answers and provide feedback</li>
        <li>Track your progress and learning history</li>
        <li>Export your study materials (if you opt in)</li>
      </ul>

      <h2>4. Data Storage and Security</h2>
      <p>
        Since data is stored locally in your browser:
      </p>
      <ul>
        <li>Your data remains on your device</li>
        <li>Clearing browser data will delete your SkillSync data</li>
        <li>Data does not sync across devices unless you use export features</li>
        <li>We do not have access to your locally stored data</li>
      </ul>

      <h2>5. Google OAuth Permissions</h2>
      <p>
        If you use the Google Docs export feature, we request the following permissions:
      </p>
      <ul>
        <li><code>documents</code> - To create Google Docs with your study materials</li>
        <li><code>drive.file</code> - To save documents to your Google Drive</li>
      </ul>
      <p>
        We only access these permissions when you explicitly click "Export to Google Docs" 
        and we do not store your Google credentials.
      </p>

      <h2>6. Cookies and Tracking</h2>
      <p>
        SkillSync does not use cookies for tracking. We only use local storage for 
        application functionality. Third-party embeds (YouTube) may set their own cookies.
      </p>

      <h2>7. Children's Privacy</h2>
      <p>
        SkillSync is not intended for children under 13. We do not knowingly collect 
        information from children under 13 years of age.
      </p>

      <h2>8. Your Rights</h2>
      <p>You have the right to:</p>
      <ul>
        <li>Clear all your data by clearing browser local storage</li>
        <li>Revoke Google OAuth permissions in your Google account settings</li>
        <li>Use the Service without creating an account</li>
        <li>Export your data using the Markdown export feature</li>
      </ul>

      <h2>9. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will notify you of any 
        changes by posting the new Privacy Policy on this page and updating the 
        "Last updated" date.
      </p>

      <h2>10. Contact Us</h2>
      <p>
        If you have questions about this Privacy Policy, please contact us through the 
        project's GitHub repository.
      </p>

      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Open Source:</strong> SkillSync is a hackathon project. You can review 
          the source code to verify our privacy practices.
        </p>
      </div>
    </LegalPage>
  );
};

export default PrivacyPolicy;
