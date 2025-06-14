import AIContentPage from '../components/AIContentPage';

interface PageProps {
  params: {
    slug: string[];
  };
}

export default async function CatchAllPage({ params }: PageProps) {
  // 构建完整的路径
  const path = '/' + (params.slug ? params.slug.join('/') : '');
  
  return <AIContentPage path={path} />;
}