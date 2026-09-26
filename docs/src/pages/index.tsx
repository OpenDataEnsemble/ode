import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import Newsletter from '@site/src/components/Newsletter';
import AnnouncementBanner from '@site/src/components/AnnouncementBanner';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx("hero", styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className={styles.heroTitle}>
          {siteConfig.tagline}
        </Heading>
        <Link className="button button--primary button--lg" to="/docs" style={{ marginTop: "2rem" }}>
          Check out the documentation
        </Link>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout title={siteConfig.title} description={siteConfig.tagline}>
      <AnnouncementBanner />
      <HomepageHeader />
      <main>
        {/* Main Description Section */}
        <section className={styles.mainSection}>
          <div className="container">
            <Heading as="h2" className={styles.sectionTitle}>
              The Open Data Ensemble
            </Heading>
            <div className={styles.sectionContent}>
              <p className={styles.descriptionText} style={{ fontStyle: 'italic', color: 'var(--ifm-color-content-secondary)', marginBottom: '0.5rem' }}>
                ODE is pronounced like "code", without the "C."
              </p>
              <p className={styles.descriptionText}>
                The Open Data Ensemble (ODE) is a comprehensive platform for building sophisticated data collection
                instruments. It provides a collection of open source technologies and resources that help you build and
                deploy digital tools for mobile data collection. Together, we envision a world where data collection is
                seamless, efficient, and accessible to everyone, enabling better decision-making through high-quality
                data.
              </p>
            </div>
          </div>
        </section>

        {/* Demo/App Showcase Section */}
        <section className={styles.showcaseSection}>
          <div className="container">
            <div className={styles.showcaseGrid}>
              <div className={styles.showcaseContent}>
                <Heading as="h2" className={styles.sectionTitle}>
                  ODE Platform Demo
                </Heading>
                <p className={styles.descriptionText}>
                  ODE is flexible by design, and applications built using the ODE framework support an exceptional range
                  of features and data collection scenarios. Explore our platform to see sample configurations, data
                  collection workflows, and more!
                </p>
                <Link
                  className="button button--primary button--lg"
                  to="/docs/development/quick-start"
                  style={{ marginTop: "1.5rem" }}
                >
                  Explore Documentation
                </Link>
              </div>
              <div className={styles.showcaseImage}>
                <img
                  src={require("@site/static/img/ensemble.png").default}
                  alt="Open Data Ensemble Platform"
                  className={styles.featureImg}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className={styles.featuresSection}>
          <div className="container">
            <HomepageFeatures />
          </div>
        </section>

        {/* Community Section */}
        <section className={styles.communitySection}>
          <div className="container">
            <div className={styles.communityGrid}>
              <div className={styles.communityImage}>
                <img
                  src={require("@site/static/img/developer_scenery.png").default}
                  alt="Community"
                  className={styles.featureImg}
                />
              </div>
              <div className={styles.communityContent}>
                <Heading as="h2" className={styles.sectionTitle}>
                  ODE Community
                </Heading>
                <p className={styles.descriptionText}>
                  The ODE Community is a space for developers, data scientists, researchers, and innovators to share
                  knowledge, provide technical assistance to other users, and explore new opportunities for learning and
                  collaboration.
                </p>
                <p className={styles.descriptionText}>
                  It features product updates and roadmaps, discussions about the resources included in ODE, and more.
                  We invite you to join us and introduce yourself!
                </p>
                <div className={styles.communityLinks}>
                  <Link
                    className="button button--primary"
                    href="https://forum.opendataensemble.org"
                    style={{ marginRight: "1rem" }}
                  >
                    Join the Community
                  </Link>
                  <Link className="button button--secondary" href="https://github.com/OpenDataEnsemble/ode">
                    View on GitHub
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Open Source Technology Section */}
        <section className={styles.opensourceSection}>
          <div className="container">
            <Heading as="h2" className={styles.sectionTitle}>
              Creating Open Source Technology Together
            </Heading>
            <div className={styles.sectionContent}>
              <p className={styles.descriptionText}>
                Developers and designers in our open source community work together to build and expand the technical
                components that power applications built with the Open Data Ensemble, explore new integrations, and
                create reference applications that serve as templates for the creation of new data collection tools.
              </p>
              <p className={styles.descriptionText}>
                Want to join us or build a new integration? Check out our{" "}
                <Link to="https://github.com/OpenDataEnsemble/ode">GitHub</Link> or join us on the{" "}
                <Link to="https://forum.opendataensemble.org">Community Forum</Link>!
              </p>
              <div style={{ marginTop: "2rem" }}>
                <Link className="button button--primary" to="/docs">
                  Technical Overview
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Get Involved Section */}
        <section className={styles.getInvolvedSection}>
          <div className="container">
            <Heading as="h2" className={styles.sectionTitle}>
              Get Involved
            </Heading>
            <div className={styles.involvedGrid}>
              <div className={styles.involvedCard}>
                <Heading as="h3" className={styles.cardTitle}>
                  Are you a developer?
                </Heading>
                <ul className={styles.involvedList}>
                  <li>
                    Help us improve the ODE <Link to="/docs">documentation</Link>
                  </li>
                  <li>
                    <Link to="https://github.com/OpenDataEnsemble/ode">Share a new idea or question</Link> on GitHub
                  </li>
                  <li>Contribute to open source components</li>
                </ul>
              </div>
              <div className={styles.involvedCard}>
                <Heading as="h3" className={styles.cardTitle}>
                  Are you a researcher or data practitioner?
                </Heading>
                <ul className={styles.involvedList}>
                  <li>
                    <Link to="https://forum.opendataensemble.org">Share your expertise</Link> on the Forum
                  </li>
                  <li>Sign up for the ODE newsletter to get the latest updates</li>
                  <li>Provide feedback on features and workflows</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Newsletter Section */}
        <section className={styles.newsletterSection}>
          <Newsletter />
        </section>
      </main>
    </Layout>
  );
}

