# syntax=docker/dockerfile:1.7
#
# Java workload layer: the JDK/build toolchain needed to build and run the Java
# evaluation target repositories (Temurin 17 + 8, Gradle, Maven). This is the
# default workload layer and is independent of the selected agent -- it builds
# `FROM ${BASE_IMAGE}`, which the orchestrator points at an agent layer.

ARG BASE_IMAGE=general-agent-eval-base:latest
FROM ${BASE_IMAGE}

ARG TARGETARCH
ARG TEMURIN_17_VERSION=17.0.19.0.0+10-0
ARG TEMURIN_8_VERSION=8.0.492.0.0+9-1
ARG GRADLE_VERSION=8.10.2
ARG GRADLE_SHA256=31c55713e40233a8303827ceb42ca48a47267a0ad4bab9177123121e71524c26
ARG MAVEN_VERSION=3.9.9
ARG MAVEN_SHA512=a555254d6b53d267965a3404ecb14e53c3827c09c3b94b5678835887ab404556bfaf78dcfe03ba76fa2508649dca8531c74bca4d5846513522404d48e8c4ac8b

ENV JAVA_HOME=/usr/lib/jvm/temurin-17-jdk-${TARGETARCH} \
    JAVA_8_HOME=/usr/lib/jvm/temurin-8-jdk-${TARGETARCH} \
    JAVA_17_HOME=/usr/lib/jvm/temurin-17-jdk-${TARGETARCH} \
    GRADLE_HOME=/opt/gradle \
    M2_HOME=/opt/maven \
    PATH=/usr/lib/jvm/temurin-17-jdk-${TARGETARCH}/bin:/opt/gradle/bin:/opt/maven/bin:$PATH

# curl, gnupg and ca-certificates come from the base image.
# pipefail so a failed curl in the `curl | gpg` key fetch fails the build.
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

USER root
RUN apt-get update \
    && curl -fsSL https://packages.adoptium.net/artifactory/api/gpg/key/public \
        | gpg --dearmor -o /usr/share/keyrings/adoptium.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/adoptium.gpg] https://packages.adoptium.net/artifactory/deb bookworm main" \
        > /etc/apt/sources.list.d/adoptium.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        "temurin-17-jdk=${TEMURIN_17_VERSION}" \
        "temurin-8-jdk=${TEMURIN_8_VERSION}" \
    && rm -rf /var/lib/apt/lists/*

RUN set -eux; \
    curl -fsSL --retry 5 --retry-delay 2 --retry-all-errors --connect-timeout 30 --max-time 600 "https://downloads.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip" -o /tmp/gradle.zip; \
    echo "${GRADLE_SHA256}  /tmp/gradle.zip" | sha256sum -c -; \
    unzip -q /tmp/gradle.zip -d /opt; \
    mv "/opt/gradle-${GRADLE_VERSION}" /opt/gradle; \
    rm /tmp/gradle.zip; \
    curl -fsSL --retry 5 --retry-delay 2 --retry-all-errors --connect-timeout 30 --max-time 600 "https://archive.apache.org/dist/maven/maven-3/${MAVEN_VERSION}/binaries/apache-maven-${MAVEN_VERSION}-bin.tar.gz" -o /tmp/maven.tar.gz; \
    echo "${MAVEN_SHA512}  /tmp/maven.tar.gz" | sha512sum -c -; \
    tar -xzf /tmp/maven.tar.gz -C /opt; \
    mv "/opt/apache-maven-${MAVEN_VERSION}" /opt/maven; \
    rm /tmp/maven.tar.gz; \
    ln -sf /opt/gradle/bin/gradle /usr/local/bin/gradle; \
    ln -sf /opt/maven/bin/mvn /usr/local/bin/mvn

USER agent
