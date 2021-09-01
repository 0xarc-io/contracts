export async function asyncForEach<T, U>(
  array: T[],
  callback: (value: T, index?: number, array?: T[]) => Promise<U>
  ) {
  for (let index = 0; index < array.length; index += 1) {
    await callback(array[index], index, array);
  }
}
