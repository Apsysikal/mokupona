export function DinnerCard() {
  return (
    <div className="relative mx-auto max-w-sm overflow-hidden rounded-lg border border-gray-200 shadow-lg">
      <img
        src="https://img.freepik.com/fotos-kostenlos/huehnchen-spiesse-mit-paprika-scheiben-und-dill_2829-18813.jpg?w=1380&t=st=1673878811~exp=1673879411~hmac=cc31add4b87c8fd6b131d16bbeb27db13d068a021ce7103c81243f87fbd8cf0f"
        alt="Chicken Plate"
        className="max-h-28 w-full object-cover"
      />
      <div className="flex flex-col gap-3 p-5">
        <div>
          <p className="font-semibold text-emerald-600">Danish Fine Food</p>
          <strong className="text-3xl text-gray-900">Maad od Venner</strong>
        </div>
        <div>
          <span className="rounded-full bg-emerald-200/50 px-2 py-1 text-xs uppercase text-emerald-800">
            Vegan
          </span>
          <span className="rounded-full bg-emerald-200/50 px-2 py-1 text-xs uppercase text-emerald-800">
            Gluten-Free
          </span>
        </div>
        <div>
          <time className="text-sm font-semibold text-emerald-600">
            21. September - 19:00 Uhr
          </time>
        </div>
        <div>
          <p className="text-gray-900">
            Lorem ipsum dolor sit amet, consectetur adipisicing elit. Magni
            cupiditate dolorem alias reprehenderit, dicta non voluptate
            aspernatur nulla quasi nobis eius placeat a quaerat, velit, error
            labore harum qui vel.
          </p>
        </div>
        <div className="flex items-center justify-between">
          <a
            href="#"
            className="rounded-md px-2 py-1 font-bold uppercase text-emerald-600 hover:bg-emerald-200/50"
          >
            Join
          </a>
          <a
            href="#"
            className="inline-block rounded-md px-2 py-1 font-bold uppercase text-emerald-600 hover:bg-emerald-200/50"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="2"
              stroke="currentColor"
              className="h-5 w-5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
              />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
