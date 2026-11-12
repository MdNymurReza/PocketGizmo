import { Bone, Loading } from "@/components/skeletons";

export default function AdminLoading() {
  return (
    <Loading label="Loading">
      <Bone className="h-8 w-48" />
      <Bone className="mt-2 h-4 w-72" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Bone key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Bone className="mt-6 h-80 rounded-xl" />
    </Loading>
  );
}
