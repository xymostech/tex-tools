import React from 'react';
import ReactDOM from 'react-dom/client';
import DviRendering from './dvi-rendering/DviRendering';
import ParagraphSplitting from './paragraph-splitting/ParagraphSplitting';
import {
  createBrowserRouter,
  RouterProvider,
  Link,
} from "react-router-dom";

import './index.css';

const router = createBrowserRouter([
  {
    path: "/",
    element: <div>
      <h1>Xymostech's TeX Tools</h1>
      <ul>
        <li><Link to={'/dvi-rendering'}>Inspectable DVI Rendering</Link></li>
        <li><Link to={'/paragraph-splitting'}>Tracing Paragraph Splitting</Link></li>
      </ul>
    </div>,
  },
  {
    path: "/dvi-rendering",
    Component: DviRendering,
  },
  {
    path: "/paragraph-splitting",
    Component: ParagraphSplitting,
  }
]);

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
