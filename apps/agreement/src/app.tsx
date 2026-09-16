import { getPage, NotFound } from './routes';

export function App({ path }: { path: string }) {
  const Page = getPage(path)?.default ?? NotFound;
  return <main>{Page ? <Page /> : <h1>页面不存在</h1>}</main>;
}
