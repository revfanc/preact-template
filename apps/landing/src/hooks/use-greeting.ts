import { useState } from 'preact/hooks';
import { toast } from '@packages/feedback';

export function useGreeting() {
  const [name, setName] = useState('');
  const [greeting, setGreeting] = useState('');

  function updateName(value: string) {
    setName(value);
    setGreeting('');
  }

  function preview() {
    const value = name.trim();
    setGreeting(value ? `你好，${value}。欢迎开启新的体验。` : '请输入称呼。');
    toast(value ? '欢迎语已生成' : '请输入称呼。');
  }

  return { name, greeting, updateName, preview };
}
