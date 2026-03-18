export async function generateNewsletterMock(
  prompt: string,
  template: string,
  headerFooter: string,
  contextFiles: any[]
): Promise<{ text: string, title: string }> {
  return new Promise((resolve) => {
    setTimeout(() => {
      let text = '';
      let title = '';

      if (template === "Product Launch") {
        title = "Introducing Our Newest Feature: AI Assist";
        text = "We are thrilled to announce the launch of AI Assist. This new feature will dramatically speed up your workflow...\n\nKey Benefits:\n- 10x faster generations\n- Better context understanding\n- Seamless integration";
      } else {
        title = "Weekly Tech Update: Q3 & Q4 Strategic Insights";
        text = `## 1. AI Integration Roadmap\nBased on the attached strategic document, we are planning to roll out the new AI tools across all departments by Q4. The key focus will be on automating routine data entry and improving customer support response times.\n\n## 2. Security Protocol Updates\nAs highlighted in the latest internal memo, all employees must complete the updated cybersecurity training by the end of the month. Phishing attempts have increased by 15% in our sector.\n\n## 3. Team Highlights\nCongratulations to the Data Science team for successfully deploying the new predictive model!`;
      }
      
      resolve({ text, title });
    }, 2000);
  });
}

export async function generateImageMock(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const newImages = [
        "https://images.unsplash.com/photo-1664575602276-acd073f104c1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
        "https://images.unsplash.com/photo-1497215728101-856f4ea42174?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
        "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
      ];
      resolve(newImages[Math.floor(Math.random() * newImages.length)]);
    }, 1500);
  });
}
