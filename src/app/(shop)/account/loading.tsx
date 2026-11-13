import { Bone, Loading } from "@/components/skeletons";

export default function AccountLoading() {
  return (
    <Loading label="Loading your account">
      <Bone className="h-8 w-56" />
      <Bone className="mt-2 h-4 w-72 max-w-full" />
      <div className="mt-6 grid grid-cols-3 gap-3 sm:gap-4">
        {[0, 1, 2].map((i) => (
          <Bone key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Bone className="mt-6 h-64 rounded-xl" />
    </Loading>
  );
}
