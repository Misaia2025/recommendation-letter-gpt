import openSaasBannerWebp from '../../client/static/open-saas-banner.webp';
import { DocsUrl } from '../../shared/common';

export default function Hero() {
  return (
    <div className='relative pt-14 w-full'>
      <TopGradient />
      <BottomGradient />
      <div className='py-8 sm:py-18'>
        <div className='mx-auto max-w-8xl px-6 lg:px-8'>
          <div className='lg:mb-20 mx-auto max-w-3xl text-center'>
            <h1 className='text-4xl font-bold text-gray-900 sm:text-6xl dark:text-white'>
             Recommendation letters, <span className='text-yellow-500'> done right.</span>
            </h1>
            <p className='mt-6 mx-auto max-w-2xl text-lg sm:text-xl md:text-2xl leading-8 text-gray-700 dark:text-white'>
            No templates. No stress. Just smart letters.
            </p>
            <div className='mt-10 flex items-center justify-center gap-x-6'>
            <a
             href="/letter/new"
              className='mt-8 inline-block rounded-xl px-6 py-3 text-base font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 shadow-md transition-transform duration-200 hover:scale-105 hover:shadow-lg bg-white dark:bg-white/10 dark:text-white dark:ring-white/20 backdrop-blur-md
             sm:px-8 sm:py-4 sm:text-lg
             md:px-10 md:py-5 md:text-xl'
              >
             Get Started <span aria-hidden='true'>→</span>
             </a>

            </div>
          </div>
          <div className='mt-14 flow-root sm:mt-14'>
            <div className='-m-2  flex justify-center rounded-xl lg:-m-4 lg:rounded-2xl lg:p-4'>
              <img
                src={openSaasBannerWebp}
                alt='App screenshot'
                width={1000}
                height={530}
                loading='lazy'
                className='rounded-md shadow-2xl ring-1 ring-gray-900/10'
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TopGradient() {
  return (
    <div
      className='absolute top-0 right-0 -z-10 transform-gpu overflow-hidden w-full blur-3xl sm:top-0'
    aria-hidden='true'
  >
    <div
      className='aspect-[1020/880] w-[55rem] flex-none sm:right-1/4 sm:translate-x-1/2 dark:hidden bg-gradient-to-tr from-amber-400 to-purple-300 opacity-40'
      style={{
        clipPath: 'polygon(80% 20%, 90% 55%, 50% 100%, 70% 30%, 20% 50%, 50% 0)',
      }}
      />
    </div>
  );
}

function BottomGradient() {
  return (
    <div
      className='absolute inset-x-0 top-[calc(100%-40rem)] sm:top-[calc(100%-65rem)] -z-10 transform-gpu overflow-hidden blur-3xl'
    aria-hidden='true'
  >
    <div
      className='relative aspect-[1020/880] sm:-left-3/4 sm:translate-x-1/4 dark:hidden bg-gradient-to-br from-amber-400 to-purple-300  opacity-50 w-[72.1875rem]'
      style={{
        clipPath: 'ellipse(80% 30% at 80% 50%)',
      }}
    />
    </div>
  );
}