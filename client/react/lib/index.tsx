import React, { useState, useEffect, useContext, FunctionComponent } from 'react';
import { DynamicoClient, DynamicoDevClient, Options, DevOptions } from '@dynamico/core';
import { Omit } from 'type-fest';

interface Component {
  view?: FunctionComponent;
}

interface setComponent {
  (component: Component): void;
}

interface ComponentOptions extends Options {
  devMode?: boolean | Partial<Omit<DevOptions, 'callback'>>;
  fallback?: JSX.Element | null;
}

export const DynamicoContext = React.createContext<DynamicoClient | undefined>(undefined);

export const DynamicoProvider: FunctionComponent<{ client: DynamicoClient }> = ({ client, children }) => (
  <DynamicoContext.Provider value={client}>{children}</DynamicoContext.Provider>
);
export const dynamico = function<T = any>(
  name: string,
  { fallback = null, devMode = false, ...options }: ComponentOptions = {}
): FunctionComponent<T> {
  return (props: T) => {
    const [Component, setComponent]: [Component, setComponent] = useState({});
    const dynamicoClient = useContext<DynamicoClient | undefined>(DynamicoContext);
    let release = () => {};

    const getComponent = async () => {
      if (!dynamicoClient) {
        throw `Couldn't find dynamico client in the context, make sure you use DynamicoContext.Provider`;
      }

      if (devMode) {
        const devClient = new DynamicoDevClient({
          dependencies: dynamicoClient.dependencies,
          ...(typeof devMode === 'object' ? devMode : {}),
          callback: (view: any) => setComponent({ view })
        });

        release = await devClient.get(name, options);

        return;
      }

      setComponent({ view: await dynamicoClient.get(name, options) });
    };

    useEffect(() => {
      getComponent();

      return () => release();
    }, []);

    return Component.view ? <Component.view {...props} /> : fallback;
  };
};
