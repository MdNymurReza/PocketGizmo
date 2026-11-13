import { Bone, Loading } from "@/components/skeletons";

export default function AdminLoading() {
  return (
    <Loading label="Loading">
      <Bone className="h-4 w-40" />
      <Bone className="mt-2 h-9 w-64 max-w-full" />
      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Bone key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Bone className="h-56 rounded-xl" />
        <Bone className="h-56 rounded-xl xl:col-span-2" />
      </div>
    </Loading>
  );
}
