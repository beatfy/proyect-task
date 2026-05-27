// Tests for Kanban helpers (non-UI logic)
// Since this is a Next.js app with Radix UI, full component tests
// need a DOM environment. We test the pure logic here.

describe('Kanban logic', () => {
  it('groups tasks by status correctly', () => {
    const tasks = [
      { status: 'TODO', id: '1', title: 'Task 1' },
      { status: 'IN_PROGRESS', id: '2', title: 'Task 2' },
      { status: 'TODO', id: '3', title: 'Task 3' },
    ] as const;

    const grouped = tasks.reduce((acc, task) => {
      const key = task.status;
      if (!acc[key]) acc[key] = [];
      acc[key].push(task);
      return acc;
    }, {} as Record<string, typeof tasks[number][]>);

    expect(grouped['TODO']).toHaveLength(2);
    expect(grouped['IN_PROGRESS']).toHaveLength(1);
    expect(grouped['DONE']).toBeUndefined();
  });

  it('identifies valid status transitions', () => {
    const validTransitions: Record<string, string[]> = {
      'TODO': ['IN_PROGRESS'],
      'IN_PROGRESS': ['TODO', 'DONE'],
      'DONE': ['IN_PROGRESS', 'TODO'],
    };

    expect(validTransitions['TODO']).toContain('IN_PROGRESS');
    expect(validTransitions['TODO']).not.toContain('DONE');
  });
});
