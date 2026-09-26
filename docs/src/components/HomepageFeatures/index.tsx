import type { ReactNode } from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  image: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Great for longitudinal field studies',
    image: require('@site/static/img/fieldworder_scenery.png').default,
    description: (
      <>
        ODE is a platform for building sophisticated data collection instruments.
      </>
    ),
  },
  {
    title: 'Focus on what matters',
    image: require('@site/static/img/planner_scenery.png').default,
    description: (
      <>
        Spend your time designing your data collection instruments instead of building the infrastructure for it.
      </>
    ),
  },
  {
    title: 'Cross platform & open source',
    image: require('@site/static/img/developer_scenery.png').default,
    description: (
      <>
        ODE is available for Android and iOS. It is 100% FLOSS (Free (Libre) Open Source Software) and focused on providing great DX
      </>
    ),
  },
];

function Feature({ title, image, description }: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <img src={image} className={styles.featureImg} alt={title} />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}

