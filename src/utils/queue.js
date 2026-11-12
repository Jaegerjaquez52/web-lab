const jobs = [];
let running = false;

export function enqueue(job) {
  jobs.push(job);
  drain();
}

async function drain() {
  if (running) return;
  running = true;
  while (jobs.length) {
    const job = jobs.shift();
    try {
      await job();
    } catch (error) {
      console.error('Помилка фонової задачі:', error);
    }
  }
  running = false;
}
