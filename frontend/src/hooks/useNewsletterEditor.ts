import { useState } from "react";
import { useSessionStore } from "../store/useSessionStore";
import { generateNewsletterMock } from "../services/mock/generationMock";

export function useNewsletterEditor() {
  const { template, setTemplate, headerFooter, setHeaderFooter, attachments } = useSessionStore();
  
  const [newsletterContent, setNewsletterContent] = useState(`## 1. AI Integration Roadmap\nBased on the attached strategic document, we are planning to roll out the new AI tools across all departments by Q4. The key focus will be on automating routine data entry and improving customer support response times.\n\n## 2. Security Protocol Updates\nAs highlighted in the latest internal memo, all employees must complete the updated cybersecurity training by the end of the month. Phishing attempts have increased by 15% in our sector.\n\n## 3. Team Highlights\nCongratulations to the Data Science team for successfully deploying the new predictive model!`);
  const [newsletterTitle, setNewsletterTitle] = useState("Weekly Tech Update: Q3 Insights");
  
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [activeTab, setActiveTab] = useState<"sources" | "settings">("sources");

  // Temp state for settings in the right panel before "regenerating"
  const [tempTemplate, setTempTemplate] = useState(template);
  const [tempHeaderFooter, setTempHeaderFooter] = useState(headerFooter);

  const handleRegenerate = async (
    setIsGeneratingCb: (val: boolean) => void,
    appendUserMessageCb: (msg: string) => void,
    appendAiMessageCb: (msg: string) => void
  ) => {
    setTemplate(tempTemplate);
    setHeaderFooter(tempHeaderFooter);
    
    const promptMsg = `Please regenerate using the ${tempTemplate} template and ${tempHeaderFooter} header/footer.`;
    appendUserMessageCb(promptMsg);
    setIsGeneratingCb(true);
    
    // Call our mock service
    const { text, title } = await generateNewsletterMock(
      promptMsg,
      tempTemplate,
      tempHeaderFooter,
      attachments
    );
    
    appendAiMessageCb(`I've regenerated the content using the ${tempTemplate} template.`);
    setNewsletterTitle(title);
    setNewsletterContent(text);
    
    setIsGeneratingCb(false);
    setActiveTab("sources");
  };

  return {
    newsletterContent,
    setNewsletterContent,
    newsletterTitle,
    setNewsletterTitle,
    isEditingContent,
    setIsEditingContent,
    activeTab,
    setActiveTab,
    tempTemplate,
    setTempTemplate,
    tempHeaderFooter,
    setTempHeaderFooter,
    handleRegenerate
  };
}
