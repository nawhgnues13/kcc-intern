import { Article } from "../../types/article";

const MOCK_ARTICLES: Article[] = [
  {
    id: "a1",
    title: "애플, 새로운 AI 맞춤형 칩 M4 시리즈 전격 공개",
    excerpt: "애플이 차세대 AI 연산에 최적화된 M4 칩셋 라인업을 새롭게 선보이며 온디바이스 AI 시장의 패권을 노린다.",
    category: "IT",
    imageUrl: "https://images.unsplash.com/photo-1541807084-5c52b6b3adef?auto=format&fit=crop&q=80&w=800",
    publishedAt: "2026-03-16T09:00:00Z",
    author: "Tech Reporter",
  },
  {
    id: "a2",
    title: "제네시스, 2026년형 전동화 모델 라인업 확장",
    excerpt: "한층 업그레이드된 주행 거리와 자율주행 3단계를 기본 탑재한 제네시스의 새로운 전기차 라인업이 공개되었다.",
    category: "Vehicle",
    imageUrl: "https://images.unsplash.com/photo-1619405399517-d7fce0f13302?auto=format&fit=crop&q=80&w=800",
    publishedAt: "2026-03-15T14:30:00Z",
    author: "Auto Desk",
  },
  {
    id: "a3",
    title: "오픈AI, 코딩 특화 모델 'GPT-5 Coder' 베타 테스트 돌입",
    excerpt: "개발자들의 생산성을 극대화할 수 있는 코딩 전용 대규모 언어 모델의 베타 서비스가 일부 기업을 대상으로 시작되었다.",
    category: "IT",
    imageUrl: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&q=80&w=800",
    publishedAt: "2026-03-14T11:15:00Z",
    author: "AI News",
  },
  {
    id: "a4",
    title: "현대자동차, 수소 연료전지 하이퍼카 콘셉트 'N Vision 75' 발표",
    excerpt: "과거와 미래를 잇는 압도적인 디자인과 친환경 고성능 파워트레인을 탑재한 콘셉트 카가 모터쇼에서 큰 주목을 받았다.",
    category: "Vehicle",
    imageUrl: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&q=80&w=800",
    publishedAt: "2026-03-13T16:45:00Z",
    author: "Car Insights",
  },
  {
    id: "a5",
    title: "클라우드 서비스 비용 최적화, 기업들의 새로운 화두",
    excerpt: "팬데믹 이후 급증한 클라우드 사용량에 따라, 불필요한 비용을 줄이고 효율을 극대화하는 솔루션들이 각광받고 있다.",
    category: "IT",
    imageUrl: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=800",
    publishedAt: "2026-03-12T10:00:00Z",
    author: "IT Business",
  },
  {
    id: "a6",
    title: "테슬라, 완전 자율주행(FSD) V14 배포 임박",
    excerpt: "머신러닝 알고리즘을 전면 개편하여 도심 주행 안전성을 획기적으로 높인 새로운 FSD 버전이 소프트웨어 업데이트로 곧 제공된다.",
    category: "Vehicle",
    imageUrl: "https://images.unsplash.com/photo-1560958089-b8a1929cea89?auto=format&fit=crop&q=80&w=800",
    publishedAt: "2026-03-11T08:20:00Z",
    author: "EV Weekly",
  }
];

export async function getRecommendedArticlesMock(): Promise<Article[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Return top 3 articles for recommended section
      resolve(MOCK_ARTICLES.slice(0, 3));
    }, 500); // simulate network delay
  });
}

export async function getAllArticlesMock(): Promise<Article[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([...MOCK_ARTICLES]);
    }, 600);
  });
}
