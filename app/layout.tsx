import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Digital Heritage — The Ambedkar Archive',description:'Explore the writings and constitutional legacy of Dr. B. R. Ambedkar through a source-linked digital archive.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
