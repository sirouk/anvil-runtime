'use client';

import React from 'react';
import { AnvilForm } from '@/components/anvil/AnvilForm';

/**
 * Anvil App Page
 * 
 * This is the main entry point for your Anvil app in NextJS.
 * By default, it renders your app's primary form.
 * 
 * URL Routes:
 * - / → Renders your app's startup form
 * - /FormName → Renders a specific form
 * 
 * Examples:
 * - /Dashboard → Renders the Dashboard form
 * - /ContactForm → Renders the ContactForm
 * 
 * Customize this page by:
 * 1. Adding your own layout around <AnvilForm />
 * 2. Using multiple <AnvilForm /> components
 * 3. Passing specific form names
 * 4. Adding NextJS features (headers, footers, sidebars)
 */

interface PageProps {
    params: { formPath?: string[] };
    searchParams: { [key: string]: string | string[] | undefined };
}

export default function AnvilAppPage({ params }: PageProps) {
    // Get the requested form from the URL path
    const formName = params.formPath?.[0];

    return (
        <div className="anvil-nextjs-app">
            {/* 
                This is all you need to render an Anvil form!
                
                The AnvilForm component handles:
                - App discovery and loading
                - WebSocket connections
                - Theme and styling
                - State management
                - Error handling
                
                You can customize it:
            */}

            {/* Option 1: Simple - renders the requested form or startup form */}
            <AnvilForm form={formName} />

            {/* Option 2: With custom layout
            <div className="my-custom-layout">
                <header>My NextJS Header</header>
                <main>
                    <AnvilForm form={formName} title="My App" />
                </main>
                <footer>My NextJS Footer</footer>
            </div>
            */}

            {/* Option 3: Multiple forms on one page
            <div className="dashboard-layout">
                <aside>
                    <AnvilForm form="Sidebar" />
                </aside>
                <main>
                    <AnvilForm form={formName || "MainContent"} />
                </main>
            </div>
            */}

            {/* Option 4: Specific forms with custom styling
            <div className="grid grid-cols-2 gap-4">
                <AnvilForm 
                    form="ContactForm" 
                    title="Contact Us"
                    className="border rounded p-4"
                />
                <AnvilForm 
                    form="NewsletterSignup" 
                    title="Subscribe"
                    className="bg-gray-100 p-4"
                />
            </div>
            */}
        </div>
    );
} 