import { auth } from "@/auth";
import { getMemories } from "@/lib/db/memory-service";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Brain, Briefcase, Heart, Lightbulb, Target } from "lucide-react";

export default async function VaultPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/');
  }

  const userId = session.user.id;
  const memories = await getMemories(userId);

  const getIcon = (type: string) => {
    switch(type) {
      case 'fact': return <Lightbulb className="w-5 h-5 text-yellow-500" />;
      case 'preference': return <Heart className="w-5 h-5 text-red-500" />;
      case 'goal': return <Target className="w-5 h-5 text-green-500" />;
      case 'ongoing_project': return <Briefcase className="w-5 h-5 text-blue-500" />;
      default: return <Brain className="w-5 h-5 text-purple-500" />;
    }
  }

  const getTypeLabel = (type: string) => {
     switch(type) {
      case 'fact': return '客观事实';
      case 'preference': return '个人偏好';
      case 'goal': return '长期目标';
      case 'ongoing_project': return '进行中项目';
      default: return type;
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center">
      <div className="w-full max-w-md bg-white min-h-screen shadow-sm relative">
        {/* Header */}
        <header className="flex items-center px-4 py-4 bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-10">
          <Link href="/" className="mr-3 p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
              <Brain className="w-5 h-5 text-purple-600" />
            </div>
            <h1 className="font-semibold text-gray-800 text-lg">记忆库 (Memory Vault)</h1>
          </div>
        </header>
        
        <main className="p-4 bg-gray-50/50 min-h-[calc(100vh-73px)]">
          {memories.length === 0 ? (
            <div className="mt-10 bg-white rounded-2xl p-8 text-center text-gray-500 shadow-sm border border-gray-100">
              <Brain className="w-12 h-12 text-gray-300 mx-auto mb-4 opacity-50" />
              <p className="font-medium text-gray-600 mb-2">记忆库还是空的</p>
              <p className="text-sm">系统每天凌晨会自动从你的日记中提炼客观事实、个人偏好和长期目标。</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {memories.map((m) => (
                <div key={m.id} className="bg-white rounded-2xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100 hover:shadow-md transition-all">
                  <div className="flex items-center gap-2 mb-3">
                    {getIcon(m.type)}
                    <span className="text-xs font-semibold text-gray-600 bg-gray-100/80 px-2.5 py-1 rounded-full">
                      {getTypeLabel(m.type)}
                    </span>
                    <span className="text-xs text-gray-400 ml-auto font-medium">{m.date}</span>
                  </div>
                  <p className="text-gray-800 leading-relaxed text-[15px]">{m.content}</p>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
