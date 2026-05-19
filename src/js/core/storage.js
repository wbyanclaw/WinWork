// 状态持久化
const storage = {
  async save(key, data) {
    return await invoke('save_state', { key, data: JSON.stringify(data) });
  },
  async load(key) {
    const data = await invoke('load_state', { key });
    return data ? JSON.parse(data) : null;
  }
};