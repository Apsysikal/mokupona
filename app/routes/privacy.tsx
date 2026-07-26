import type { ReactNode } from "react";

import type { Route } from "./+types/privacy";

import { PageContainer, pageTitleClassName } from "~/components/section";
import { cn } from "~/lib/utils";

export const meta: Route.MetaFunction = () => [{ title: "Privacy Policy" }];

export default function PrivacyPage() {
  return (
    <PageContainer className="max-w-4xl grow pt-7 pb-20 md:pt-16">
      <h1 className={cn("mb-9 md:mb-12", pageTitleClassName)}>
        Privacy Policy
      </h1>

      <div className="flex flex-col gap-10 md:gap-12">
        <Section title="Responsibility">
          <P>
            The responsible entity within the meaning of the General Data
            Protection Regulation and other national data protection laws of the
            member states, as well as other data protection regulations, is:
          </P>
          <P>
            moku pona
            <br />
            Regensbergstrasse 24
            <br />
            8050 Zürich
            <br />
            Switzerland
            <br />
            Email: mokuponadinnerclub@gmail.com
            <br />
            Website: https://mokupona.ch
          </P>
        </Section>

        <Section title="General Information on Data Processing">
          <Sub title="Scope of Processing of Personal Data">
            <P>
              We process personal data of our users only to the extent necessary
              to provide a functional website as well as our content and
              services. The processing of personal data of our users regularly
              occurs only with the user’s consent. Exceptions apply in cases
              where obtaining prior consent is not possible for practical
              reasons and the processing of the data is permitted by legal
              provisions.
            </P>
          </Sub>

          <Sub title="Legal Basis for the Processing of Personal Data">
            <P>
              When obtaining the consent of the data subject for processing
              operations involving personal data, Article 6(1)(a) of the EU
              General Data Protection Regulation (GDPR) serves as the legal
              basis.
              <br />
              If the processing of personal data is necessary for the
              performance of a contract to which the data subject is a party,
              Article 6(1)(b) GDPR serves as the legal basis. This also applies
              to processing required for pre-contractual measures.
              <br />
              If the processing of personal data is necessary for compliance
              with a legal obligation to which our organization is subject,
              Article 6(1)(c) GDPR serves as the legal basis.
              <br />
              If the processing is necessary to protect vital interests of the
              data subject or another natural person, Article 6(1)(d) GDPR
              serves as the legal basis.
              <br />
              If the processing is necessary for the purposes of legitimate
              interests pursued by our organization or a third party and these
              interests are not overridden by the interests, rights, or freedoms
              of the data subject, Article 6(1)(f) GDPR serves as the legal
              basis.
            </P>
          </Sub>

          <Sub title="Data Deletion and Retention">
            <P>
              Personal data of the data subject will be deleted or blocked as
              soon as the purpose of storage ceases. Storage may occur beyond
              this if provided for by European or national legislation in EU
              regulations, laws, or other provisions to which the controller is
              subject. Data will also be blocked or deleted when a retention
              period prescribed by the aforementioned norms expires unless
              further storage is necessary for the conclusion or performance of
              a contract.
            </P>
          </Sub>
        </Section>

        <Section title="Provisioning of the Website and Creation of Log Files">
          <Sub title="Description and Scope of Data Processing">
            <P>
              Every time our website is accessed, our system automatically
              collects data and information from the computer system of the
              accessing device.
            </P>
            <P>The following data are collected:</P>
            <Ol>
              <li>Information about the browser type and version used</li>
              <li>The user’s operating system</li>
              <li>The user’s IP address</li>
              <li>Date and time of access</li>
              <li>
                Websites from which the user’s system accessed our website
              </li>
              <li>Websites accessed by the user’s system via our website</li>
            </Ol>
            <P>
              The data are also stored in our system’s log files. This data is
              not stored together with other personal data of the user.
            </P>
          </Sub>

          <Sub title="Legal Basis for Data Processing">
            <P>
              The legal basis for the temporary storage of data and log files is
              Article 6(1)(f) GDPR.
            </P>
          </Sub>

          <Sub title="Purpose of Data Processing">
            <P>
              The temporary storage of the IP address by the system is necessary
              to deliver the website to the user’s computer. For this, the
              user’s IP address must remain stored for the duration of the
              session.
              <br />
              Storage in log files is carried out to ensure the functionality of
              the website. Additionally, the data help us optimize the website
              and ensure the security of our information technology systems. No
              data analysis for marketing purposes takes place in this context.
              <br />
              Our legitimate interest in data processing under Article 6(1)(f)
              GDPR also lies in these purposes.
            </P>
          </Sub>

          <Sub title="Duration of Storage">
            <P>
              The data will be deleted as soon as it is no longer necessary to
              achieve the purpose of its collection. In the case of data
              collection for providing the website, this occurs when the session
              ends. For log file storage, this occurs after a maximum of seven
              days. Extended storage is possible. In such cases, the IP
              addresses of users are deleted or anonymized, making it impossible
              to associate them with the accessing client.
            </P>
          </Sub>

          <Sub title="Objection and Removal Options">
            <P>
              Data collection for the provision of the website and storage of
              data in log files are essential for the operation of the website.
              Therefore, users cannot object to this.
            </P>
          </Sub>
        </Section>

        <Section title="Use of Cookies">
          <Sub title="Description and Scope of Data Processing">
            <P>
              Our website uses cookies. Cookies are text files stored in the
              internet browser or by the internet browser on the user’s computer
              system. When a user accesses a website, a cookie may be stored on
              the user’s operating system. This cookie contains a distinctive
              string of characters that allows for the unique identification of
              the browser upon re-accessing the website.
              <br />
              We use cookies to make our website functional. Some elements of
              our website require that the browser be recognized even after a
              page transition.
            </P>
            <P>The following data are stored and transmitted in cookies:</P>
            <Ol>
              <li>Login information</li>
            </Ol>
          </Sub>

          <Sub title="Legal Basis for Data Processing">
            <P>
              The legal basis for the processing of personal data using
              technically necessary cookies within the meaning of Section 25(2)
              TTDSG is Article 6(1)(f) GDPR.
            </P>
          </Sub>

          <Sub title="Purpose of Data Processing">
            <P>
              The use of technically necessary cookies is to enable the
              functionality of our website. Certain functions of our website
              cannot be provided without cookies. These require the browser to
              be recognized after a page transition.
            </P>
            <P>We use cookies for the following purposes:</P>
            <Ol>
              <li>Login information</li>
            </Ol>
            <P>
              The user data collected through technically necessary cookies are
              not used to create user profiles.
              <br />
              Our legitimate interest in processing personal data under Article
              6(1)(f) GDPR lies in these purposes.
            </P>
          </Sub>

          <Sub title="Duration of Storage, Objection, and Removal Options">
            <P>
              Cookies are stored on the user’s computer and transmitted to our
              site. Therefore, as a user, you have full control over the use of
              cookies. By changing the settings in your internet browser, you
              can deactivate or restrict the transmission of cookies. Cookies
              already stored can be deleted at any time. This can also be done
              automatically. If cookies are deactivated for our website, it may
              no longer be possible to use all functions of the website fully.
            </P>
          </Sub>
        </Section>

        <Section title="Registration">
          <Sub title="Description and Scope of Data Processing">
            <P>
              Our website offers users the option to register by providing
              personal data. The data are entered into an input mask,
              transmitted to us, and stored. No data is disclosed to third
              parties.
            </P>
            <P>
              The following data are collected during the registration process:
            </P>
            <Ol>
              <li>User’s email address</li>
              <li>Date and time of registration</li>
            </Ol>
            <P>
              As part of the registration process, the user’s consent to process
              these data is obtained.
            </P>
          </Sub>

          <Sub title="Legal Basis for Data Processing">
            <P>
              The legal basis for processing the data is the user’s consent
              under Article 6(1)(a) GDPR.
            </P>
          </Sub>

          <Sub title="Purpose of Data Processing">
            <P>
              User registration is necessary for providing certain content and
              services on our website.
            </P>
          </Sub>

          <Sub title="Duration of Storage">
            <P>
              The data will be deleted as soon as they are no longer necessary
              for achieving the purpose for which they were collected. For data
              collected during the registration process, this is the case when
              the user’s registration is canceled or modified on our website.
            </P>
          </Sub>

          <Sub title="Objection and Removal Options">
            <P>
              As a user, you may cancel your registration at any time. You may
              also request that the data stored about you be modified.
              <br />
              To do so, contact us using the contact details provided above.
            </P>
          </Sub>
        </Section>

        <Section title="Signing up for an event">
          <Sub title="Description and Scope of Data Processing">
            <P>
              Our website offers users the option to sign up for our events by
              providing personal data. The data are entered into an input mask,
              transmitted to us, and stored. No data is disclosed to third
              parties.
            </P>
            <P>The following data are collected during the sign up process:</P>
            <Ol>
              <li>User’s name</li>
              <li>User’s email address</li>
              <li>User’s phone number</li>
              <li>User’s dietary preferences and restrictions</li>
              <li>If the user is a student or not</li>
              <li>
                A notification text provided by the user intended for additional
                information
              </li>
              <li>Date and time of sign up</li>
            </Ol>
            <P>
              As part of the sign up process, the user’s consent to process
              these data is obtained.
            </P>
          </Sub>

          <Sub title="Legal Basis for Data Processing">
            <P>
              The legal basis for processing the data is the user’s consent
              under Article 6(1)(a) GDPR and Article 6(1)(b) GDPR.
            </P>
          </Sub>

          <Sub title="Purpose of Data Processing">
            <P>
              User sign up is necessary to fulfill a contract with the user or
              to carry out pre-contractual measures.
            </P>
            <P>This may include one or all of the following:</P>
            <Ol>
              <li>
                Contacting the user through the provided contact information
                regarding the event
              </li>
              <li>
                Checking if the event menu contains any critical food according
                to the provided restrictions
              </li>
              <li>
                Calculating the cost according to menu preferences and active
                enrollments at a university
              </li>
              <li>Processing additional information provided by the user</li>
            </Ol>
          </Sub>

          <Sub title="Duration of Storage">
            <P>
              The data will be deleted as soon as they are no longer necessary
              for achieving the purpose for which they were collected. This is
              the case for the data collected during the sign up process to
              fulfill a contract or to carry out pre-contractual measures, when
              the data is no longer required for the execution of the contract.
              Even after the contract has been completed, there may still be a
              need to store the personal data of the contracting party to comply
              with contractual or legal obligations. In accordance with legal
              regulations, data retention is carried out in particular for 10
              years pursuant to Article 958 of the Swiss Code of Obligations
              (OR) and Article 70 of the Value Added Tax Act (MwStG).
            </P>
          </Sub>

          <Sub title="Objection and Removal Options">
            <P>
              As a user, you may cancel your sign up at any time. You may also
              request that the data stored about you be modified.
              <br />
              To do so, contact us using the contact details provided above. If
              the data is required to fulfill a contract or to carry out
              pre-contractual measures, early deletion of the data is only
              possible insofar as contractual or legal obligations do not
              prevent deletion.
            </P>
          </Sub>
        </Section>

        <Section title="Contact Form and Email Contact">
          <Sub title="Description and Scope of Data Processing">
            <P>
              Our website includes a contact form that can be used for
              electronic communication. If a user takes advantage of this
              option, the data entered into the input mask are transmitted to
              and stored by us.
            </P>
            <P>These data include:</P>
            <Ol>
              <li>User’s email address</li>
              <li>Date and time of contact</li>
            </Ol>
            <P>
              When submitting the form, your consent to process the data is
              obtained, and this privacy policy is referenced.
              <br />
              Alternatively, contact can be made via the provided email address.
              In this case, the user’s personal data transmitted with the email
              will be stored. No data will be disclosed to third parties. Data
              will be used exclusively for processing the conversation.
            </P>
          </Sub>

          <Sub title="Legal Basis for Data Processing">
            <P>
              The legal basis for processing data with user consent is Article
              6(1)(a) GDPR.
              <br />
              If the email contact aims to conclude a contract, the additional
              legal basis for processing is Article 6(1)(b) GDPR.
            </P>
          </Sub>

          <Sub title="Purpose of Data Processing">
            <P>
              Processing personal data from the input mask is solely for
              handling the contact request. In the case of email contact, this
              also constitutes our necessary legitimate interest in processing
              the data.
              <br />
              Additional personal data collected during the submission process
              prevents misuse of the contact form and ensures the security of
              our information technology systems.
            </P>
          </Sub>

          <Sub title="Duration of Storage">
            <P>
              The data will be deleted as soon as they are no longer necessary
              for the purpose for which they were collected. For data from the
              contact form and those sent via email, this occurs when the
              conversation with the user has ended. A conversation is considered
              ended when the circumstances indicate that the relevant matter has
              been conclusively resolved.
              <br />
              Additional personal data collected during the submission process
              will be deleted no later than seven days after collection.
            </P>
          </Sub>

          <Sub title="Objection and Removal Options">
            <P>
              The user can revoke their consent to process personal data at any
              time. If the user contacts us via email, they can object to the
              storage of their personal data at any time. In such cases, the
              conversation cannot continue.
              <br />
              All personal data stored during contact will be deleted in this
              case.
            </P>
          </Sub>
        </Section>

        <Section title="Changes to Our Privacy Policy">
          <P>
            We reserve the right to update this privacy policy to reflect
            changes in legal requirements or changes to our services, such as
            when introducing new services. For your next visit, the new privacy
            policy will apply.
          </P>
          <P>Last updated: February 5, 2025</P>
        </Section>
      </div>
    </PageContainer>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-2xl font-light tracking-tight md:text-3xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Sub({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xl font-light tracking-tight">{title}</h3>
      {children}
    </div>
  );
}

function P({ children }: { children: ReactNode }) {
  return (
    <p className="text-foreground/80 text-base leading-relaxed font-light">
      {children}
    </p>
  );
}

function Ol({ children }: { children: ReactNode }) {
  return (
    <ol className="text-foreground/80 list-decimal space-y-1 pl-5 text-base leading-relaxed font-light">
      {children}
    </ol>
  );
}
